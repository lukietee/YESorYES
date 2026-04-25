import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBearer } from "@/lib/auth";
import { appendStatus } from "@/lib/kv";
import { publish } from "@/lib/pusher";
import { STAGES, type AgentStatus } from "@/lib/types";

const Body = z.object({
  taskId: z.string().min(1),
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  type: z.enum(["progress", "done", "error"]),
  detail: z.string(),
});

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const status: AgentStatus = { ...parsed.data, ts: Date.now() };

  await appendStatus(status);
  await publish("agent-status", "update", status);

  return NextResponse.json({ ok: true });
}
