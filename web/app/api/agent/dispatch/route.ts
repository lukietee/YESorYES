import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBearer } from "@/lib/auth";
import { TASK_TEMPLATES } from "@/lib/agentTasks";
import { publish } from "@/lib/pusher";
import { STAGES, type AgentTask } from "@/lib/types";

const Body = z.object({
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  chosen: z.enum(["A", "B"]),
  text: z.string().min(1),
});

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { callSid, stage, chosen, text } = parsed.data;

  const template = TASK_TEMPLATES[stage];
  const task: AgentTask = {
    taskId: crypto.randomUUID(),
    callSid,
    stage,
    chosen,
    text,
    instruction: template.instruction(text),
    timeoutSec: template.timeoutSec,
  };

  await publish("agent-tasks", "dispatch", task);

  return NextResponse.json({ ok: true, taskId: task.taskId });
}
