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

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          handle.onToolStart?.(event.content_block.name);
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          handle.onTextDelta(delta.text);
        }
      }
    }

    const finalMsg = await stream.finalMessage();
    console.log("[claude] stop_reason=", finalMsg.stop_reason, "content=", JSON.stringify(finalMsg.content).slice(0, 500));
    conversation.push({ role: "assistant", content: finalMsg.content });

    const toolUses = finalMsg.content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );

    if (toolUses.length === 0) {
      handle.onEnd();
      return;
    }

    // Flush so the user hears the narration NOW while the tool runs.
    handle.onSubTurnEnd();

    // Execute every tool_use the assistant just emitted, then feed all the
    // tool_results back as a single user message.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result = await runTool(callSid, tu.name, tu.input as Record<string, unknown>);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: result.stringified,
      });
    }
    conversation.push({ role: "user", content: toolResults });
    // Loop again to let the model produce its narration after the tool calls.
  }
}
