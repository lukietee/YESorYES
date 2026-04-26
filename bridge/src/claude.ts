import Anthropic from "@anthropic-ai/sdk";
import { PERSONA_SYSTEM } from "./persona.js";
import { TOOL_DEFINITIONS, runTool } from "./tools.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-haiku-4-5-20251001";

export interface BrainTurnHandle {
  /** Called for every text delta as it streams from Claude. Pipe to TTS. */
  onTextDelta: (text: string) => void;
  /** Called when the model emits a tool_use block — paused, run tool, get result, continue. */
  onToolStart?: (name: string) => void;
  /** Called between sub-turns. Flush whatever text was streamed so far so the
   *  user hears it before a tool starts running. */
  onSubTurnEnd: () => void;
  /** Called when the whole turn fully ends (no more tool calls, no more text). */
  onEnd: () => void;
}

/**
 * Run a single user-turn through Claude with tool use. May invoke multiple
 * tools in sequence before producing the final assistant text.
 *
 * Mutates `conversation` in place by appending the assistant content + any
 * tool_result content blocks.
 */
export async function runBrainTurn(
  callSid: string,
  conversation: Anthropic.MessageParam[],
  handle: BrainTurnHandle,
): Promise<void> {
  // System prompt is split into two cacheable blocks so Anthropic caches
  // the persona + tool defs across turns within this call.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: PERSONA_SYSTEM,
      cache_control: { type: "ephemeral" },
    },
  ];

  while (true) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: TOOL_DEFINITIONS,
      messages: conversation,
    });

    // After the first tool_use opens in the stream, gate text deltas so
    // anything Claude says AFTER a tool call doesn't reach the caller's
    // ear in this sub-turn. Without this gate, "voting now ... and the
    // winner is X" can leak post-tool speculation into pre-tool audio.
    let seenToolUse = false;
    let textDeltasEmitted = 0;
    let firstToolName: string | null = null;
    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          if (seenToolUse) continue; // ignore second tool_use start
          seenToolUse = true;
          firstToolName = event.content_block.name;
          handle.onToolStart?.(event.content_block.name);
        }
      } else if (event.type === "content_block_delta") {
        if (seenToolUse) continue;
        const delta = event.delta;
        if (delta.type === "text_delta") {
          handle.onTextDelta(delta.text);
          textDeltasEmitted++;
        }
      }
    }

    const finalMsg = await stream.finalMessage();
    console.log("[claude] stop_reason=", finalMsg.stop_reason, "content=", JSON.stringify(finalMsg.content).slice(0, 500));

    // Drop any tool_use blocks past the first so the assistant message we
    // record matches the single tool_result we'll feed back. Otherwise
    // Anthropic errors on the next turn ("tool_use_id missing tool_result").
    let firstToolSeen = false;
    const filteredContent = finalMsg.content.filter((c) => {
      if (c.type !== "tool_use") return true;
      if (firstToolSeen) return false;
      firstToolSeen = true;
      return true;
    });
    conversation.push({ role: "assistant", content: filteredContent });

    const toolUses = filteredContent.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );

    if (toolUses.length === 0) {
      handle.onEnd();
      return;
    }

    // Flush so the user hears the narration NOW while the tool runs.
    handle.onSubTurnEnd();

    // Only execute the FIRST tool_use this response emitted. If Claude
    // tries to chain (e.g. present_options + wait_for_decision in one
    // response), the second tool's narration would have leaked into the
    // first sub-turn's audio. By dropping the trailing tool_use, the
    // model is forced to re-emit it on the next iteration with its own
    // pre-tool narration based on the latest tool_result.
    const tu = toolUses[0];

    // Fallback narration: if Claude is about to call a tool with NO
    // preceding text (especially common on dispatch_action right after
    // wait_for_decision returns), synthesize a one-liner from the tool
    // input so the caller doesn't hear silence. This is a structural
    // safety net under the persona's narration rule.
    if (textDeltasEmitted === 0) {
      const fallback = synthesizeFallbackLine(tu.name, tu.input as Record<string, unknown>);
      if (fallback) {
        console.log(`[claude] no-text fallback for ${tu.name}: ${fallback}`);
        handle.onTextDelta(fallback);
      }
    }

    const result = await runTool(callSid, tu.name, tu.input as Record<string, unknown>);
    const toolResults: Anthropic.ToolResultBlockParam[] = [
      {
        type: "tool_result",
        tool_use_id: tu.id,
        content: result.stringified,
      },
    ];
    conversation.push({ role: "user", content: toolResults });
    // Loop again to let the model produce its narration after the tool call.
  }
}

function synthesizeFallbackLine(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  if (toolName === "dispatch_action") {
    const text = (input.text as string) ?? "";
    if (text) return `${text.toLowerCase()}, here we go.`;
    return "here we go, dingus.";
  }
  if (toolName === "wait_for_decision") return "voting now.";
  if (toolName === "present_options") return "options incoming, dingus.";
  if (toolName === "wait_for_agent_status") return "watch this.";
  return null;
}
