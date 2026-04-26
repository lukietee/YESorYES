import { NextResponse } from "next/server";
import {
  clearAll,
  getCurrentCallSid,
  getDecision,
  getOptions,
  getStage,
} from "@/lib/kv";

export async function DELETE() {
  await clearAll();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const callSid = await getCurrentCallSid();
  if (!callSid) return NextResponse.json({ idle: true });

  const stage = await getStage(callSid);
  if (!stage) return NextResponse.json({ idle: true, callSid });

  const [options, decision] = await Promise.all([
    getOptions(callSid, stage),
    getDecision(callSid, stage),
  ]);

  return NextResponse.json({ idle: false, callSid, stage, options, decision });
}
