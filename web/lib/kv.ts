import Redis from "ioredis";
import type {
  AgentStatus,
  DecisionPayload,
  OptionsPayload,
  Stage,
} from "./types";

const ONE_HOUR = 60 * 60;

let _redis: Redis | null = null;

export function redis(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error("KV_REDIS_URL not configured");
  _redis = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
  return _redis;
}

export const keys = {
  stage: (sid: string) => `call:${sid}:stage`,
  options: (sid: string, stage: Stage) => `call:${sid}:options:${stage}`,
  decision: (sid: string, stage: Stage) => `call:${sid}:decision:${stage}`,
  status: (sid: string, stage: Stage) => `call:${sid}:status:${stage}`,
  currentCall: () => "current_call_sid",
};

async function setJson(key: string, value: unknown, ttlSec = ONE_HOUR) {
  await redis().set(key, JSON.stringify(value), "EX", ttlSec);
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redis().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setStage(sid: string, stage: Stage) {
  await redis().set(keys.stage(sid), stage, "EX", ONE_HOUR);
  await redis().set(keys.currentCall(), sid, "EX", ONE_HOUR);
}

export async function getStage(sid: string): Promise<Stage | null> {
  return ((await redis().get(keys.stage(sid))) as Stage | null) ?? null;
}

export async function setOptions(payload: OptionsPayload) {
  await setJson(keys.options(payload.callSid, payload.stage), payload);
  await redis().set(keys.currentCall(), payload.callSid, "EX", ONE_HOUR);
}

export async function getOptions(sid: string, stage: Stage) {
  return await getJson<OptionsPayload>(keys.options(sid, stage));
}

export async function setDecision(payload: DecisionPayload) {
  await setJson(keys.decision(payload.callSid, payload.stage), payload);
}

export async function getDecision(sid: string, stage: Stage) {
  return await getJson<DecisionPayload>(keys.decision(sid, stage));
}

export interface StatusEntry {
  latest: string;
  history: string[];
}

export async function getStatus(sid: string, stage: Stage) {
  return await getJson<StatusEntry>(keys.status(sid, stage));
}

export async function appendStatus(s: AgentStatus) {
  const key = keys.status(s.callSid, s.stage);
  const existing = (await getJson<StatusEntry>(key)) ?? {
    latest: "",
    history: [],
  };
  // Tag entries with their type so polling consumers can detect terminal states.
  const tag = s.type === "done" ? "[done] " : s.type === "error" ? "[error] " : "";
  const tagged = `${tag}${s.detail}`;
  const next: StatusEntry = {
    latest: tagged,
    history: [...existing.history, tagged].slice(-32),
  };
  await setJson(key, next);
}

export async function getCurrentCallSid() {
  return (await redis().get(keys.currentCall())) ?? null;
}

export async function clearAll() {
  const r = redis();
  const stream = r.scanStream({ match: "call:*", count: 200 });
  for await (const batch of stream) {
    if (batch.length) await r.del(...(batch as string[]));
  }
  await r.del(keys.currentCall());
}
