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
      return { stringified: JSON.stringify(out), raw: out };
    }
    case "wait_for_decision": {
      // Poll up to 60s by retrying the 10s long-poll endpoint.
      const start = Date.now();
      while (Date.now() - start < 60_000) {
        const out = (await postWeb("/api/options/decision", {
          ...input,
          callSid,
          timeoutMs: 10_000,
        })) as
          | { pending: true }
          | { stage: string; chosen: "A" | "B"; text: string; vote: { L: number; R: number } };
        if (!("pending" in out)) {
          return { stringified: JSON.stringify(out), raw: out };
        }
      }
      const fallback = { error: "decision timeout" };
      return { stringified: JSON.stringify(fallback), raw: fallback };
    }
    case "dispatch_action": {
      const out = await postWeb("/api/agent/dispatch", { ...input, callSid });
      return { stringified: JSON.stringify(out), raw: out };
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
          return { stringified: JSON.stringify(out), raw: out };
        }
      }
      const fallback = { error: "no agent status updates yet" };
      return { stringified: JSON.stringify(fallback), raw: fallback };
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
