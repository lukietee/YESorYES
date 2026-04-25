import { NextResponse } from "next/server";
import { z } from "zod";
import { setDecision, setStage } from "@/lib/kv";
import { publish } from "@/lib/pusher";
import { STAGES } from "@/lib/types";

const Body = z.object({
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  chosen: z.enum(["A", "B"]),
  text: z.string().min(1),
  vote: z.object({ L: z.number().int(), R: z.number().int() }),
});

// Called from the display browser after countdown ends.
// Auth: same INTERNAL_TOKEN bearer (display reads it from a server-rendered
// hidden field or client env). For demo simplicity, we accept either bearer
// auth or a same-origin request.
export async function POST(req: Request) {
  const expected = process.env.INTERNAL_TOKEN;
  const got = req.headers.get("authorization");
  const sameOrigin = req.headers.get("origin")
    ? req.headers.get("origin") === new URL(req.url).origin
    : false;

  if (got !== `Bearer ${expected}` && !sameOrigin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data;

  await setStage(payload.callSid, payload.stage);
  await setDecision(payload);
  await publish("decisions", "decided", payload);

  return NextResponse.json({ ok: true });
}
