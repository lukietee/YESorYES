import type Anthropic from "@anthropic-ai/sdk";

const STAGES = [
  "intro",
  "ig-swipe",
  "book-flight",
  "book-activity",
  "book-restaurant",
] as const;

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "present_options",
    description:
      "Show two options on the TV behind the fish tank. Call this immediately after you have decided what the user's two paths forward are. Each option label should be evocative and under 80 characters.",
    input_schema: {
      type: "object",
      required: ["stage", "option_a", "option_b"],
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        option_a: { type: "string", description: "Left option, max 80 chars." },
        option_b: { type: "string", description: "Right option, max 80 chars." },
      },
    },
  },
  {
    name: "wait_for_decision",
    description:
      "Wait for the three guppies to vote on which option to pick. Returns the winning option's letter ('A' or 'B') and its text. Call this immediately after present_options. While it is pending, narrate brief filler in character.",
    input_schema: {
      type: "object",
      required: ["stage"],
      properties: { stage: { type: "string", enum: [...STAGES] } },
    },
  },
  {
    name: "dispatch_action",
    description:
      "Send the chosen option to the remote computer-use agent so it can execute the action in real life. Call this after wait_for_decision returns.",
    input_schema: {
      type: "object",
      required: ["stage", "chosen", "text"],
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        chosen: { type: "string", enum: ["A", "B"] },
        text: { type: "string" },
      },
    },
  },
  {
    name: "wait_for_agent_status",
    description:
      "Wait for the remote computer-use agent to make progress (or finish, or fail). Call this after dispatch_action so you can hear what the agent is doing before moving on. Returns the latest status detail and a flag for whether the agent is done. Repeat-call this until done is true to follow along live.",
    input_schema: {
      type: "object",
      required: ["stage"],
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        minUpdates: {
          type: "number",
          description:
            "Minimum number of status updates to wait for before resolving (default 1).",
        },
        until: {
          type: "string",
          enum: ["progress", "done", "error", "any"],
          description:
            "Resolve only when this kind of status lands. Use 'done' to wait for completion, 'any' to get the next update.",
        },
      },
    },
  },
  {
    name: "report_done",
    description:
      "Mark the current stage as complete. Call this when you are ready to move on to the next stage of the demo.",
    input_schema: {
      type: "object",
      required: ["stage", "summary"],
      properties: {
        stage: { type: "string", enum: [...STAGES] },
        summary: { type: "string" },
      },
    },
  },
];

const WEB = process.env.WEB_BASE_URL!;
const TOKEN = process.env.INTERNAL_TOKEN!;

async function postWeb(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${WEB}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`web ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function runTool(
  callSid: string,
  name: string,
  input: Record<string, unknown>,
): Promise<{ stringified: string; raw: unknown }> {
  switch (name) {
    case "present_options": {
      const out = await postWeb("/api/options/present", { ...input, callSid });
      const stage = (input as { stage?: string }).stage ?? "ig-swipe";
      const directive =
        `Options are now showing on the TV. ` +
        `YOUR NEXT STEP IS REQUIRED: respond with a 2-4 word spoken line like "voting now" ` +
        `and immediately call wait_for_decision(stage="${stage}"). ` +
        `Do NOT end the turn. Do NOT repeat your previous line. Do NOT mention either option's text. ` +
        `Do NOT predict who wins. Just speak briefly and call wait_for_decision next.`;
      return { stringified: directive, raw: out };
    }
    case "wait_for_decision": {
      console.log(`[wait_for_decision] start callSid=${callSid} input=${JSON.stringify(input)}`);
      // Tighter inner long-poll (3s windows) so any failure surfaces fast
      // instead of looking like a 10s freeze on the call. Total wait is
      // capped to 30s overall (still plenty for a deliberation).
      const start = Date.now();
      while (Date.now() - start < 30_000) {
        const out = (await postWeb("/api/options/decision", {
          ...input,
          callSid,
          timeoutMs: 3_000,
        })) as
          | { pending: true }
          | { stage: string; chosen: "A" | "B"; text: string; vote: { L: number; R: number } };
        if (!("pending" in out)) {
          console.log(`[wait_for_decision] resolved chosen=${out.chosen} text="${out.text}" elapsed=${Date.now() - start}ms`);
          // Format the result so Claude can't misread it. The verbose
          // string forces it to use the actual winning text rather than
          // guessing which option won.
          const human =
            `The council voted. WINNER is option_${out.chosen}. ` +
            `You MUST speak these EXACT words to the caller as your next ` +
            `spoken line, paraphrased naturally: "${out.text}". ` +
            `Then call dispatch_action with chosen="${out.chosen}" and text="${out.text}". ` +
            `Do not say the other option won. Do not invent a different winner. ` +
            `(stage=${out.stage}, vote L:${out.vote.L} R:${out.vote.R})`;
          console.log(`[wait_for_decision] result string returned to claude:\n${human}`);
          return { stringified: human, raw: out };
        }
      }
      console.log(`[wait_for_decision] TIMED OUT after ${Date.now() - start}ms`);
      const fallback =
        "ERROR: decision timeout — no vote arrived. Tell the caller " +
        "the council was distracted and ask them to repeat. Do NOT call dispatch_action.";
      return { stringified: fallback, raw: { error: "decision timeout" } };
    }
    case "dispatch_action": {
      const out = await postWeb("/api/agent/dispatch", { ...input, callSid });
      const stage = (input as { stage?: string }).stage ?? "ig-swipe";
      const directive =
        `Agent dispatched. ` +
        `YOUR NEXT STEP IS REQUIRED: respond with a 3-5 word spoken line like "watch this, muppet" ` +
        `and immediately call wait_for_agent_status(stage="${stage}", until="done"). ` +
        `Do NOT end the turn. Do NOT mention the option text again.`;
      return { stringified: directive, raw: out };
    }
    case "wait_for_agent_status": {
      // Long-poll the wait endpoint, retry once on a 202 (no updates yet).
      const start = Date.now();
      while (Date.now() - start < 30_000) {
        const out = (await postWeb("/api/agent/wait", {
          ...input,
          callSid,
          timeoutMs: 10_000,
        })) as
          | { pending: true }
          | { latest: string; history: string[]; done: boolean; error: boolean };
        if (!("pending" in out)) {
          const summary = out.latest ?? "(no update)";
          const isDone = out.done === true;
          if (isDone) {
            const directive =
              `Agent finished. Latest status: "${summary}". ` +
              `THIS IS THE FINAL STEP: respond with ONE snarky closing line (≤10 words) ` +
              `referencing what just happened. Do NOT call any more tools. End the turn after speaking.`;
            return { stringified: directive, raw: out };
          }
          // Not done yet — keep updating but don't loop forever.
          const directive =
            `Agent progress: "${summary}". ` +
            `Speak ONE short snarky line (≤8 words) about this update, ` +
            `then call wait_for_agent_status again with until="done" to keep watching.`;
          return { stringified: directive, raw: out };
        }
      }
      const fallback =
        `Agent has gone quiet. ` +
        `Speak ONE snarky closing line about the silence. Do NOT call any more tools.`;
      return { stringified: fallback, raw: { error: "no agent status updates yet" } };
    }
    case "report_done": {
      // No-op on the server side; just lets Claude close out the stage.
      return { stringified: JSON.stringify({ ok: true }), raw: { ok: true } };
    }
    default:
      return {
        stringified: JSON.stringify({ error: `unknown tool ${name}` }),
        raw: { error: `unknown tool ${name}` },
      };
  }
}
