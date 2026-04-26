import type { ScriptedStep } from "./index.js";
import { sendOutlookEmail } from "../native.js";

const TO = process.env.BOSS_EMAIL ?? "lucastrinh@gmail.com";
const SUBJECT = "today";
const BODY =
  "hey, taking the day. frick the meeting, frick the standup, frick the roadmap. talk monday.";

export const steps: ScriptedStep[] = [
  {
    detail: "opening Outlook — the council disclaims liability for HR",
    run: async () => {
      await new Promise((r) => setTimeout(r, 200));
    },
  },
  {
    detail: "drafting the resignation-adjacent email, oh my cod",
    run: async () => {
      await sendOutlookEmail({ to: TO, subject: SUBJECT, body: BODY });
    },
  },
];
