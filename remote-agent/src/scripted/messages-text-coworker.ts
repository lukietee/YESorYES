import type { ScriptedStep } from "./index.js";
import { sendIMessage } from "../native.js";

// Messages.app — text the coworker.
//
// Recipient defaults to a demo placeholder. Override with env var
// IG_COWORKER_RECIPIENT before the demo. Contact name, phone number,
// or iMessage email all work.

const RECIPIENT = process.env.IG_COWORKER_RECIPIENT ?? "Coworker";
const BODY =
  "hey small thing — got a sec? the council says i should be talking to you instead of spiraling. open to lunch?";

export const steps: ScriptedStep[] = [
  {
    detail: "opening Messages — the council prefers you talk to anyone normal",
    run: async () => {
      await new Promise((r) => setTimeout(r, 200));
    },
  },
  {
    detail: "drafting a wholesome coworker text, holy mackerel",
    run: async () => {
      await sendIMessage({ recipient: RECIPIENT, body: BODY });
    },
  },
];
