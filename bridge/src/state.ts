import type { WebSocket } from "ws";
import type Anthropic from "@anthropic-ai/sdk";

export interface CallState {
  callSid: string;
  streamSid: string;
  twilioWs: WebSocket;
  conversation: Anthropic.MessageParam[];
  currentStage: string;
  closed: boolean;
}

const calls = new Map<string, CallState>();

export function getCall(callSid: string): CallState | undefined {
  return calls.get(callSid);
}

export function putCall(state: CallState) {
  calls.set(state.callSid, state);
}

export function dropCall(callSid: string) {
  calls.delete(callSid);
}
