import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

// book-restaurant: deep-link into the actual restaurant page or a map result.
// Looks like the agent went and pulled up the place itself.

// OpenTable's listing URL for Dill, Reykjavik. If they renamed the slug we
// fall back to the search route that still returns the listing.
const A_URL =
  "https://www.opentable.com/dill-restaurant-reservations-reykjavik";
const B_URL =
  "https://www.bing.com/maps?q=fish+and+chips+reykjavik+cheap+dive";

export const A: ScriptedStep[] = [
  {
    detail: "the council is opening OpenTable — Dill, Reykjavik, table for one",
    run: async (page: Page) => {
      await page.goto(A_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    detail: "Michelin star loaded — eat alone with class, you waterlogged dingus",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "the fish smell grease — opening Bing Maps for dive-bar fish & chips",
    run: async (page: Page) => {
      await page.goto(B_URL, { waitUntil: "domcontentloaded" });
    },
  },
  {
    detail: "map pins loaded — eat standing in the rain, scaleless dummy",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];
