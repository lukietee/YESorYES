import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

export const A: ScriptedStep[] = [
  {
    detail: "the fish are sweating — opening Bing to ghost-write your apology",
    run: async (page: Page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing the grovel template, you absolute muppet",
    run: async (page: Page) => {
      await page.keyboard.type("drunk text ex apology paragraph template that always works", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "holy mackerel here we go — Bing, prep the wyd arsenal",
    run: async (page: Page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing 'wyd' tactics for 12 randoms because the council insists",
    run: async (page: Page) => {
      await page.keyboard.type("wyd text response rate 12 different randoms", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];
