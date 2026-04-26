import type { Page } from "playwright";
import { A as igSwipeA, B as igSwipeB } from "./ig-swipe.js";
import { A as bookFlightA, B as bookFlightB } from "./book-flight.js";
import { A as bookActivityA, B as bookActivityB } from "./book-activity.js";
import { A as bookRestaurantA, B as bookRestaurantB } from "./book-restaurant.js";
import { steps as textEx } from "./messages-text-ex.js";
import { steps as textCoworker } from "./messages-text-coworker.js";

/**
 * One step in a scripted stage. `detail` is what the audience sees in the
 * /display ExecutingPanel. `run` does the actual work.
 *
 * The optional `page` arg is a headed Playwright page. Browser-driving
 * scripts use it; native-app scripts (Messages, Reminders, Outlook, etc.)
 * ignore it and shell out to osascript via helpers in ../native.ts.
 *
 * Keep each step quick (≤ 1.5s) so the demo stays snappy.
 */
export interface ScriptedStep {
  detail: string;
  run: (page: Page) => Promise<void>;
}

// Text-keyed scripts override stage+chosen lookup so multiple hardcoded
// scenarios that all use stage=ig-swipe (breakup / meeting / job loss)
// can each have their own behaviour based on the dispatch's `text` field.
const TEXT_SCRIPTS: Record<string, ScriptedStep[]> = {
  "Text ex (bad)": textEx,
  "Text coworker (good)": textCoworker,
  // Other hardcoded scenarios fall through to the stage+chosen browser
  // scripts for now. Add entries here as native counterparts get built:
  //   "Set a reminder (good)": remindersSet,
  //   "Email boss to frick off (bad)": outlookEmailBoss,
  //   "Beg for a job in the comments (sad)": linkedinBegPosts,
  //   "Post your .env file on LinkedIn (cursed)": linkedinPostEnv,
};

const STAGE_SCRIPTS: Record<string, { A: ScriptedStep[]; B: ScriptedStep[] }> = {
  "ig-swipe": { A: igSwipeA, B: igSwipeB },
  "book-flight": { A: bookFlightA, B: bookFlightB },
  "book-activity": { A: bookActivityA, B: bookActivityB },
  "book-restaurant": { A: bookRestaurantA, B: bookRestaurantB },
};

export function getScript(
  stage: string,
  chosen: "A" | "B",
  text?: string,
): ScriptedStep[] | null {
  if (text && TEXT_SCRIPTS[text]) return TEXT_SCRIPTS[text];
  return STAGE_SCRIPTS[stage]?.[chosen] ?? null;
}
