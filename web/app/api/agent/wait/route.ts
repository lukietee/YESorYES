import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBearer } from "@/lib/auth";
import { getStatus } from "@/lib/kv";
import { STAGES } from "@/lib/types";

const Body = z.object({
  callSid: z.string().min(1),
  stage: z.enum(STAGES),
  /** Wait until at least this many status updates have landed. */
  minUpdates: z.number().int().min(1).max(20).default(1),
  /** Resolve early if a status of this type lands. */
  until: z.enum(["progress", "done", "error", "any"]).default("any"),
  timeoutMs: z.number().int().min(1000).max(20_000).default(10_000),
});

export async function POST(req: Request) {
  const unauth = requireBearer(req);
  if (unauth) return unauth;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { callSid, stage, minUpdates, until, timeoutMs } = parsed.data;

  const deadline = Date.now() + timeoutMs;
  const pollMs = 200;

  while (Date.now() < deadline) {
    const entry = await getStatus(callSid, stage);
    if (entry && entry.history.length >= minUpdates) {
      const lastDetail = entry.latest;
      const isDone = lastDetail?.startsWith("[done]");
      const isError = lastDetail?.startsWith("[error]");
      const matched =
        until === "any" ||
        (until === "done" && isDone) ||
        (until === "error" && isError) ||
        (until === "progress" && !isDone && !isError);
      if (matched) {
        return NextResponse.json({
          latest: stripTag(entry.latest),
          history: entry.history.map(stripTag),
          done: Boolean(isDone),
          error: Boolean(isError),
        });
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return NextResponse.json({ pending: true }, { status: 202 });
}

function stripTag(s: string): string {
  return s.replace(/^\[(done|error)\]\s*/, "");
}
