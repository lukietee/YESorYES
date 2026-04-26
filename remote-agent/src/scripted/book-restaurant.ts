import type { ScriptedStep } from "./index.js";

export const A: ScriptedStep[] = [
  {
    detail: "opening Bing — the fish demand white tablecloths",
    run: async (page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing 'dill reykjavik michelin reservation for one (sad)'",
    run: async (page) => {
      await page.keyboard.type(
        "dill restaurant reykjavik michelin reservation for one",
        { delay: 30 },
      );
      await page.keyboard.press("Enter");
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "opening Bing Maps — the fish smell grease from here",
    run: async (page) => {
      await page.goto("https://www.bing.com/maps");
    },
  },
  {
    detail: "typing 'cheapest dive bar fish and chips reykjavik standing room'",
    run: async (page) => {
      await page.keyboard.type(
        "cheapest dive bar fish and chips reykjavik standing room",
        { delay: 30 },
      );
      await page.keyboard.press("Enter");
    },
  },
];
