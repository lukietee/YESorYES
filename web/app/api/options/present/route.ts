import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBearer } from "@/lib/auth";
import { setOptions, setStage } from "@/lib/kv";
import { publish } from "@/lib/pusher";
import { STAGES } from "@/lib/types";

const Body = z.object({
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  option_a: z.string().min(1).max(120),
  option_b: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  await setStage(payload.callSid, payload.stage);
  await setOptions(payload);
  await publish("options", "present", payload);

  return NextResponse.json({ ok: true });
}
