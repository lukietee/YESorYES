import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

// ig-swipe: the fish have decided how the user should behave on social media.
// We use X's intent/post URL — no login required, shows the compose modal
// with the message pre-filled. Looks like the agent went and started writing
// the thing for them.

const APOLOGY = encodeURIComponent(
  "Hey, I saw your Instagram and I'm not okay, but the fish told me to write this anyway. Paragraph 1 of 9 incoming.",
);
const WYD = encodeURIComponent("wyd");

export const A: ScriptedStep[] = [
  {
    detail: "the fish are opening X dot com to ghost-write your apology",
    run: async (page: Page) => {
      await page.goto(`https://twitter.com/intent/post?text=${APOLOGY}`, {
        waitUntil: "domcontentloaded",
      });
    },
  },
  {
    detail: "your 9-paragraph grovel is loaded into the box, you absolute muppet",
    run: async (page: Page) => {
      await page.waitForTimeout(2000);
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "holy mackerel — opening X dot com, prep the wyd arsenal",
    run: async (page: Page) => {
      await page.goto(`https://twitter.com/intent/post?text=${WYD}`, {
        waitUntil: "domcontentloaded",
      });
    },
  },
  {
    detail: "'wyd' loaded — the council suggests 11 more sends, bottom-feeder",
    run: async (page: Page) => {
      await page.waitForTimeout(2000);
    },
  },
];
