/**
 * Wrappers for Claude Computer Use tool calls on macOS.
 *
 * The `computer` tool emits actions like:
 *   { action: "screenshot" }
 *   { action: "left_click", coordinate: [x, y] }
 *   { action: "type", text: "hello" }
 *   { action: "key", text: "Return" }
 *   { action: "mouse_move", coordinate: [x, y] }
 *   { action: "scroll", coordinate: [x, y], scroll_direction: "down", scroll_amount: 3 }
 *
 * We translate each into native macOS commands. Smaller dependency footprint
 * than nut-js: shell out to `screencapture`, `cliclick`, and AppleScript.
 *
 * Required brew installs on the remote MacBook:
 *   brew install cliclick
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

interface ToolResult {
  type: "tool_result";
  is_error?: boolean;
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
  >;
}

export async function runComputerTool(input: Record<string, unknown>): Promise<ToolResult> {
  const action = input.action as string;
  try {
    switch (action) {
      case "screenshot":
        return await screenshot();
      case "left_click":
        return await click(input.coordinate as [number, number], "left");
      case "right_click":
        return await click(input.coordinate as [number, number], "right");
      case "double_click":
        return await click(input.coordinate as [number, number], "double");
      case "mouse_move":
        return await move(input.coordinate as [number, number]);
      case "type":
        return await typeText(input.text as string);
      case "key":
        return await key(input.text as string);
      case "scroll": {
        const dir = (input.scroll_direction as string) ?? "down";
        const amt = (input.scroll_amount as number) ?? 3;
        return await scroll(input.coordinate as [number, number], dir, amt);
      }
      case "wait": {
        const sec = (input.duration as number) ?? 1;
        await new Promise((r) => setTimeout(r, sec * 1000));
        return ok(`waited ${sec}s`);
      }
      default:
        return err(`unknown action: ${action}`);
    }
  } catch (e) {
    return err(`tool error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function runBashTool(input: Record<string, unknown>): Promise<ToolResult> {
  const command = input.command as string;
  if (!command) return err("empty command");
  try {
    const { stdout, stderr } = await exec("bash", ["-lc", command], { maxBuffer: 1024 * 1024 });
    const out = (stdout ?? "") + (stderr ? `\n[stderr]\n${stderr}` : "");
    return ok(out || "(no output)");
  } catch (e: any) {
    return err(`bash failed: ${e?.message ?? e}`);
  }
}

async function screenshot(): Promise<ToolResult> {
  const file = path.join(tmpdir(), `agent-${Date.now()}.png`);
  await exec("screencapture", ["-x", file]);
  const data = await fs.readFile(file);
  await fs.unlink(file).catch(() => {});
  return {
    type: "tool_result",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: data.toString("base64") },
      },
    ],
  };
}

async function click([x, y]: [number, number], kind: "left" | "right" | "double"): Promise<ToolResult> {
  const cmd =
    kind === "left" ? `c:${x},${y}` : kind === "right" ? `rc:${x},${y}` : `dc:${x},${y}`;
  await exec("cliclick", [cmd]);
  return ok(`${kind}-click ${x},${y}`);
}

async function move([x, y]: [number, number]): Promise<ToolResult> {
  await exec("cliclick", [`m:${x},${y}`]);
  return ok(`move ${x},${y}`);
}

async function typeText(text: string): Promise<ToolResult> {
  await exec("cliclick", [`t:${text}`]);
  return ok(`typed ${text.length} chars`);
}

async function key(combo: string): Promise<ToolResult> {
  // Map common Anthropic-style combos to cliclick syntax.
  // "Return" -> kp:return, "ctrl+a" -> kd:ctrl t:a ku:ctrl, etc.
  const lower = combo.toLowerCase();
  const map: Record<string, string> = {
    return: "return",
    enter: "return",
    escape: "esc",
    tab: "tab",
    space: "space",
    delete: "delete",
    backspace: "delete",
    up: "arrow-up",
    down: "arrow-down",
    left: "arrow-left",
    right: "arrow-right",
  };
  if (map[lower]) {
    await exec("cliclick", [`kp:${map[lower]}`]);
    return ok(`key ${combo}`);
  }
  // For chords just emit them via AppleScript keystroke
  const script = `tell application "System Events" to keystroke ${JSON.stringify(combo)}`;
  await exec("osascript", ["-e", script]);
  return ok(`key ${combo}`);
}

async function scroll(
  [x, y]: [number, number],
  dir: string,
  amount: number,
): Promise<ToolResult> {
  await exec("cliclick", [`m:${x},${y}`]);
  const sign = dir === "up" || dir === "left" ? 1 : -1;
  for (let i = 0; i < amount; i++) {
    const script = `tell application "System Events" to scroll ${sign * 3} ${dir === "left" || dir === "right" ? "horizontal" : "vertical"}`;
    await exec("osascript", ["-e", script]).catch(() => {});
  }
  return ok(`scroll ${dir} x${amount}`);
}

function ok(text: string): ToolResult {
  return { type: "tool_result", content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { type: "tool_result", is_error: true, content: [{ type: "text", text }] };
}
