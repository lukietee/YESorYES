export const STAGES = [
  "intro",
  "ig-swipe",
  "book-flight",
  "book-activity",
  "book-restaurant",
] as const;

export type Stage = (typeof STAGES)[number];

export type Side = "L" | "R";
export type Choice = "A" | "B";

export interface FishPos {
  counts: { L: number; R: number };
  total: number;
  ts: number;
}

export interface OptionsPayload {
  callSid: string;
  stage: Stage;
  option_a: string;
  option_b: string;
}

export interface DecisionPayload {
  callSid: string;
  stage: Stage;
  chosen: Choice;
  text: string;
  vote: { L: number; R: number };
}

export interface AgentTask {
  taskId: string;
  callSid: string;
  stage: Stage;
  chosen: Choice;
  instruction: string;
  timeoutSec: number;
}

export type AgentStatusType = "progress" | "done" | "error";

export interface AgentStatus {
  taskId: string;
  callSid: string;
  stage: Stage;
  type: AgentStatusType;
  detail: string;
  ts: number;
}

export type PusherChannel =
  | "fish-pos"
  | "options"
  | "decisions"
  | "agent-tasks"
  | "agent-status";
