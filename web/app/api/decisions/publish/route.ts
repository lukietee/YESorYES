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
// Auth: bearer token (server-side callers like the bridge) OR same-origin
// (display browser). We don't ship INTERNAL_TOKEN to the client, so the
// display has to rely on origin/referer matching.
export async function POST(req: Request) {
  const expected = process.env.INTERNAL_TOKEN;
  const got = req.headers.get("authorization");
  if (expected && got === `Bearer ${expected}`) {
    return handle(req);
  }

  const reqOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  // Some browsers omit `Origin` on same-origin POSTs; fall back to Referer.
  const sameOrigin =
    (origin && origin === reqOrigin) ||
    (!!referer && new URL(referer).origin === reqOrigin);
  if (!sameOrigin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handle(req);
}

async function handle(req: Request) {

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
