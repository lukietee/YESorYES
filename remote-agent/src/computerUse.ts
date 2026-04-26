import Anthropic from "@anthropic-ai/sdk";
import { runComputerTool, runBashTool } from "./tools.js";
import { postStatus } from "./status.js";
import { STAGE_PROMPTS } from "./stages/index.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-sonnet-4-5";
const COMPUTER_BETA = "computer-use-2025-01-24";
const MAX_ITERATIONS = 30;
const MAX_TOKENS = 1024;
// How many of the most recent tool_result screenshots to keep in the message
// history. Older screenshots get replaced with a text placeholder so we don't
// re-upload + re-prefill ~1500 tokens of stale image data every iteration.
const KEEP_RECENT_SCREENSHOTS = 2;

interface AgentTask {
  taskId: string;
  callSid: string;
  stage: keyof typeof STAGE_PROMPTS;
  chosen: "A" | "B";
  instruction: string;
  timeoutSec: number;
}

export async function runStage(task: AgentTask): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + task.timeoutSec * 1000;
  const stagePrompt = STAGE_PROMPTS[task.stage];

  // Stages without a real Computer Use prompt (e.g. "intro") short-circuit:
  // post done immediately so the bridge can advance instead of hanging.
  if (!stagePrompt || stagePrompt === "no-op") {
    await postStatus({ ...statusBase(task), type: "done", detail: `${task.stage} acknowledged` });
    return;
  }

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: "user", content: task.instruction },
  ];

  await postStatus({ ...statusBase(task), type: "progress", detail: `starting ${task.stage}` });

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (Date.now() > deadline) {
      await postStatus({ ...statusBase(task), type: "error", detail: "timeout — fish gave up" });
      return;
    }

    const resp = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: stagePrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          type: "computer_20250124",
          name: "computer",
          display_width_px: Number(process.env.DISPLAY_WIDTH_PX ?? 1920),
          display_height_px: Number(process.env.DISPLAY_HEIGHT_PX ?? 1080),
        },
        { type: "bash_20250124", name: "bash" },
      ],
      betas: [COMPUTER_BETA],
      messages,
    });

    messages.push({ role: "assistant", content: resp.content });

    const toolUses = resp.content.filter(
      (c): c is Anthropic.Beta.Messages.BetaToolUseBlock => c.type === "tool_use",
    );

    if (toolUses.length === 0) {
      const finalText =
        resp.content.find((c): c is Anthropic.Beta.Messages.BetaTextBlock => c.type === "text")
          ?.text ?? "done";
      await postStatus({ ...statusBase(task), type: "done", detail: finalText.slice(0, 240) });
      return;
    }

    const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result =
        tu.name === "bash"
          ? await runBashTool(tu.input as Record<string, unknown>)
          : await runComputerTool(tu.input as Record<string, unknown>);
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: result.content,
        is_error: result.is_error,
      });

      const summary = summarizeAction(tu);
      if (summary) {
        await postStatus({ ...statusBase(task), type: "progress", detail: summary });
      }
    }

    messages.push({ role: "user", content: results });
    trimOldScreenshots(messages, KEEP_RECENT_SCREENSHOTS);
  }

  await postStatus({ ...statusBase(task), type: "error", detail: "max iterations exceeded" });
}

/**
 * Walk the message history backward; the most recent `keep` tool_result blocks
 * containing images stay intact, anything older has its image blocks swapped
 * for a short text placeholder. Mutates messages in place.
 */
function trimOldScreenshots(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
  keep: number,
): void {
  let kept = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user" || typeof msg.content === "string") continue;
    for (const block of msg.content) {
      if (block.type !== "tool_result") continue;
      if (typeof block.content === "string" || !Array.isArray(block.content)) continue;
      const hasImage = block.content.some((b) => b && (b as { type?: string }).type === "image");
      if (!hasImage) continue;
      if (kept < keep) {
        kept++;
        continue;
      }
      block.content = block.content.map((b) =>
        b && (b as { type?: string }).type === "image"
          ? { type: "text", text: "[earlier screenshot omitted to save tokens]" }
          : b,
      ) as typeof block.content;
    }
  }
}

function statusBase(task: AgentTask) {
  return { taskId: task.taskId, callSid: task.callSid, stage: task.stage };
}

function summarizeAction(tu: Anthropic.Beta.Messages.BetaToolUseBlock): string | null {
  const input = tu.input as Record<string, unknown>;
  if (tu.name === "bash") {
    const cmd = (input.command as string) ?? "";
    return `bash: ${cmd.slice(0, 80)}`;
  }
  if (tu.name === "computer") {
    const action = input.action as string;
    if (action === "screenshot") return null; // too noisy
    if (action === "type") return `type: "${(input.text as string)?.slice(0, 40)}"`;
    if (action === "key") return `key: ${input.text}`;
    if (action?.includes("click")) return `${action} ${JSON.stringify(input.coordinate)}`;
    return action;
  }
  return null;
}
