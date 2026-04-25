import { kv } from "@vercel/kv";
import type {
  AgentStatus,
  DecisionPayload,
  OptionsPayload,
  Stage,
} from "./types";

const ONE_HOUR = 60 * 60;

export const keys = {
  stage: (sid: string) => `call:${sid}:stage`,
  options: (sid: string, stage: Stage) => `call:${sid}:options:${stage}`,
  decision: (sid: string, stage: Stage) => `call:${sid}:decision:${stage}`,
  status: (sid: string, stage: Stage) => `call:${sid}:status:${stage}`,
  currentCall: () => "current_call_sid",
};

export async function setStage(sid: string, stage: Stage) {
  await kv.set(keys.stage(sid), stage, { ex: ONE_HOUR });
  await kv.set(keys.currentCall(), sid, { ex: ONE_HOUR });
}

export async function getStage(sid: string): Promise<Stage | null> {
  return (await kv.get<Stage>(keys.stage(sid))) ?? null;
}

export async function setOptions(payload: OptionsPayload) {
  await kv.set(keys.options(payload.callSid, payload.stage), payload, {
    ex: ONE_HOUR,
  });
  await kv.set(keys.currentCall(), payload.callSid, { ex: ONE_HOUR });
}

export async function getOptions(sid: string, stage: Stage) {
  return (await kv.get<OptionsPayload>(keys.options(sid, stage))) ?? null;
}

export async function setDecision(payload: DecisionPayload) {
  await kv.set(keys.decision(payload.callSid, payload.stage), payload, {
    ex: ONE_HOUR,
  });
}

export async function getDecision(sid: string, stage: Stage) {
  return (await kv.get<DecisionPayload>(keys.decision(sid, stage))) ?? null;
}

export async function appendStatus(s: AgentStatus) {
  const key = keys.status(s.callSid, s.stage);
  const existing =
    (await kv.get<{ latest: string; history: string[] }>(key)) ?? {
      latest: "",
      history: [],
    };
  // Tag entries with their type so polling consumers can detect terminal states.
  const tag = s.type === "done" ? "[done] " : s.type === "error" ? "[error] " : "";
  const tagged = `${tag}${s.detail}`;
  const next = {
    latest: tagged,
    history: [...existing.history, tagged].slice(-32),
  };
  await kv.set(key, next, { ex: ONE_HOUR });
}

export async function getCurrentCallSid() {
  return (await kv.get<string>(keys.currentCall())) ?? null;
}
