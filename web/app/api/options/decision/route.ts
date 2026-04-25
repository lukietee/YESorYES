import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBearer } from "@/lib/auth";
import { getDecision } from "@/lib/kv";
import { STAGES } from "@/lib/types";

const Body = z.object({
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  timeoutMs: z.number().int().min(1000).max(20_000).optional(),
});

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { callSid, stage, timeoutMs = 10_000 } = parsed.data;

  const deadline = Date.now() + timeoutMs;
  const pollMs = 200;

  while (Date.now() < deadline) {
    const decision = await getDecision(callSid, stage);
    if (decision) return NextResponse.json(decision);
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return NextResponse.json({ pending: true }, { status: 202 });
}
