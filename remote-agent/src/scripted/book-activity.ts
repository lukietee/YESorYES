import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

// book-activity: deep-link into GetYourGuide with the search query preloaded.
// Real activity listings render — looks like the agent shopped for it.

const A_URL =
  "https://www.getyourguide.com/s/?q=northern+lights+bus+tour+reykjavik";
const B_URL = "https://www.getyourguide.com/s/?q=tokyo+ramen+tour";

export const A: ScriptedStep[] = [
  {
    detail: "opening GetYourGuide — bundle up, you frostbitten loner",
    run: async (page: Page) => {
      await page.goto(A_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    detail: "tour listings loading — your aurora pilgrimage awaits, alone",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "opening GetYourGuide — loosen the belt, you noodle gremlin",
    run: async (page: Page) => {
      await page.goto(B_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    detail: "ramen tours loading — seven bowls of regret incoming",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];
