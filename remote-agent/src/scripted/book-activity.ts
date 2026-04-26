import type { ScriptedStep } from "./index.js";

export const A: ScriptedStep[] = [
  {
    detail: "opening Bing — bundle up, you frostbitten loner",
    run: async (page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "typing your sad little aurora pilgrimage into the search box",
    run: async (page) => {
      await page.keyboard.type("northern lights bus tour reykjavik solo traveler", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];

export const B: ScriptedStep[] = [
  {
    detail: "opening Bing — loosen the belt, you noodle gremlin",
    run: async (page) => {
      await page.goto("https://www.bing.com");
    },
  },
  {
    detail: "searching seven bowls of regret in one tragic night",
    run: async (page) => {
      await page.keyboard.type("tokyo ramen crawl 7 shops one night all you can eat", { delay: 30 });
      await page.keyboard.press("Enter");
    },
  },
];
