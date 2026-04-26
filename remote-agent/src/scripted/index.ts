import type { Page } from "playwright";
import { A as igSwipeA, B as igSwipeB } from "./ig-swipe.js";
import { A as bookFlightA, B as bookFlightB } from "./book-flight.js";
import { A as bookActivityA, B as bookActivityB } from "./book-activity.js";
import { A as bookRestaurantA, B as bookRestaurantB } from "./book-restaurant.js";

/**
 * One step in a scripted stage. `detail` is what the audience sees in the
 * /display ExecutingPanel. `run` is the actual Playwright work.
 *
 * Keep each step quick (≤ 1.5s) so the demo stays snappy. If a single step
 * needs to fill a search box AND press enter AND wait for results, that is
 * still one step from the user's perspective — just keep the `detail` short
 * and snarky.
 */
export interface ScriptedStep {
  detail: string;
  run: (page: Page) => Promise<void>;
}

const STAGE_SCRIPTS: Record<string, { A: ScriptedStep[]; B: ScriptedStep[] }> = {
  "ig-swipe": { A: igSwipeA, B: igSwipeB },
  "book-flight": { A: bookFlightA, B: bookFlightB },
  "book-activity": { A: bookActivityA, B: bookActivityB },
  "book-restaurant": { A: bookRestaurantA, B: bookRestaurantB },
};

export function getScript(stage: string, chosen: "A" | "B"): ScriptedStep[] | null {
  return STAGE_SCRIPTS[stage]?.[chosen] ?? null;
}
