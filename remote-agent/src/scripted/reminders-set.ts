import type { ScriptedStep } from "./index.js";
import { addReminder } from "../native.js";

const TITLE = process.env.MEETING_REMINDER_TITLE ?? "Meeting today — don't be late";
const BODY = "the council saved your job. you owe them.";

export const steps: ScriptedStep[] = [
  {
    detail: "opening Reminders — finally, a competent decision",
    run: async () => {
      await new Promise((r) => setTimeout(r, 200));
    },
  },
  {
    detail: "filing the reminder so you don't forget, dingus",
    run: async () => {
      await addReminder({ title: TITLE, body: BODY });
    },
  },
];
