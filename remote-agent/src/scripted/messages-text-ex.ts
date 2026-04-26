import type { ScriptedStep } from "./index.js";
import { sendIMessage } from "../native.js";

// Messages.app — text the ex.
//
// Recipient defaults to a demo placeholder. Override with env var
// IG_EX_RECIPIENT before the demo. It can be a contact name, a phone
// number (+15555550100), or an iMessage email.

const RECIPIENT = process.env.IG_EX_RECIPIENT ?? "Ex";
const BODY =
  "hey i know we said no contact but the fish council told me to text you so here we are";

export const steps: ScriptedStep[] = [
  {
    detail: "opening Messages — the council disclaims liability for the ex",
    run: async () => {
      // Just trigger via a no-op; the actual work is in the next step so the
      // detail text gets time to appear on the display first.
      await new Promise((r) => setTimeout(r, 200));
    },
  },
  {
    detail: "typing the regret-text into Messages, you absolute muppet",
    run: async () => {
      await sendIMessage({ recipient: RECIPIENT, body: BODY });
    },
  },
];
