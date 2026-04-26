import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

// book-flight: deep-link directly into Kayak with origin/dest preloaded.
// Kayak's URL pattern /flights/<ORIGIN>-<DEST>/<DATE> renders the actual
// search results page, not just a query.

function dateNDaysOut(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

const A_DATE = dateNDaysOut(2);
const B_DATE = dateNDaysOut(2);

export const A: ScriptedStep[] = [
  {
    detail: "the council is opening Kayak — one-way to Iceland, no take-backs",
    run: async (page: Page) => {
      await page.goto(`https://www.kayak.com/flights/SFO-KEF/${A_DATE}`, {
        waitUntil: "domcontentloaded",
      });
    },
  },
  {
    detail: "results loading — say goodbye to your serotonin, you scaleless dummy",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "the council is opening Kayak — one-way to Tokyo, pack the jet lag",
    run: async (page: Page) => {
      await page.goto(`https://www.kayak.com/flights/SFO-HND/${B_DATE}`, {
        waitUntil: "domcontentloaded",
      });
    },
  },
  {
    detail: "results loading — enjoy the 14-hour overnight, land mammal",
    run: async (page: Page) => {
      await page.waitForTimeout(2500);
    },
  },
];
