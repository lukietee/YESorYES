import Anthropic from "@anthropic-ai/sdk";
import { runComputerTool, runBashTool } from "./tools.js";
import { postStatus } from "./status.js";
import { STAGE_PROMPTS } from "./stages/index.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-opus-4-7";
const COMPUTER_BETA = "computer-use-2025-01-24";
const MAX_ITERATIONS = 30;

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
      max_tokens: 4096,
      system: stagePrompt,
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
  }

  await postStatus({ ...statusBase(task), type: "error", detail: "max iterations exceeded" });
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
