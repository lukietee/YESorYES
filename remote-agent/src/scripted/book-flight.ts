import type { ScriptedStep } from "./index.js";

export const A: ScriptedStep[] = [
  {
    detail: "opening Bing — the council does not do round trips",
    run: async (page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing it out — you're going to Iceland and you'll like it, you scaleless dummy",
    run: async (page) => {
      await page.keyboard.type("one way flight SFO to Reykjavik tomorrow", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "opening Bing — pack light, the fish have spoken",
    run: async (page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing it out — enjoy the jet lag, land mammal",
    run: async (page) => {
      await page.keyboard.type("one way flight SFO to Tokyo tomorrow", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];
