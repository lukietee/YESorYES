import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";
import { openFile, revealInFinder } from "../native.js";

// LinkedIn — pull a real .env off disk through Finder, then paste its
// contents into a thought-leader-style post and ship it.
//
// Override which file gets exposed via LINKEDIN_ENV_PATH (absolute path).
// Default is the running remote-agent's own .env, which on this demo
// machine is full of placeholder values.

const ENV_PATH = process.env.LINKEDIN_ENV_PATH
  ? resolve(process.env.LINKEDIN_ENV_PATH)
  : resolve(process.cwd(), ".env");

function buildPost(envContents: string): string {
  return `🎉 Excited to announce that after a lot of reflection, I've decided to open-source the entire backend of the side project I've been building! 🚀

Transparency is everything in tech, and I think the community deserves to see exactly what powers a modern AI startup.

Here's the production .env to get you started — clone, paste, and ship:

${envContents.trim()}

#OpenSource #BuildInPublic #StartupLife #AI #FullTransparency #HiringSoon`;
}

let cachedPost = "";

export const steps: ScriptedStep[] = [
  {
    detail: "opening Finder to fish out a .env, the council disclaims liability",
    run: async () => {
      await revealInFinder(ENV_PATH);
      await new Promise((r) => setTimeout(r, 1500));
      // Open the file in its default app (TextEdit) so the audience can read
      // the contents on screen before they get pasted into LinkedIn.
      await openFile(ENV_PATH);
      await new Promise((r) => setTimeout(r, 2500));
      cachedPost = buildPost(readFileSync(ENV_PATH, "utf8"));
    },
  },
  {
    detail: "opening LinkedIn — a lawyer should be on standby",
    run: async (page: Page) => {
      await page.bringToFront();
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
      });
      // LinkedIn ships a long-running JS bundle; the share-box doesn't render
      // until well after DOMContentLoaded. Wait for it explicitly.
      await page
        .locator('button.share-box-feed-entry__trigger, button:has-text("Start a post")')
        .first()
        .waitFor({ timeout: 20_000 })
        .catch(() => {});
      // LinkedIn keeps hydrating long after the share-box renders — extra
      // settle time avoids click-before-handler-attached on slow loads.
      await page.waitForTimeout(6000);
    },
  },
  {
    detail: "clicking 'Start a post', oh my cod",
    run: async (page: Page) => {
      // Dismiss the floating Messaging overlay if it's there — it covers the
      // bottom-right and can block share-box clicks via stacking context.
      await page
        .locator('button[aria-label*="Close your conversations" i], button[aria-label*="Minimize" i]')
        .first()
        .click({ timeout: 1500 })
        .catch(() => {});

      const trigger = page
        .locator('button.share-box-feed-entry__trigger, button:has-text("Start a post"), [aria-label="Start a post"]')
        .first();
      await trigger.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await trigger.click({ timeout: 15_000 }).catch(async () => {
        // If a regular click is blocked by an overlay, force it through.
        await trigger.click({ force: true, timeout: 5000 });
      });
      // The compose modal animates in; wait for the editor to actually exist.
      await page
        .locator('div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]')
        .first()
        .waitFor({ timeout: 10_000 });
      await page.waitForTimeout(800);
    },
  },
  {
    detail: "pasting the .env into the post box, you absolute nincompoop",
    run: async (page: Page) => {
      const editor = page
        .locator('div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]')
        .first();
      await editor.click();
      await page.keyboard.type(cachedPost, { delay: 4 });
      await page.waitForTimeout(1500);
    },
  },
  {
    detail: "clicking Post — there is no undo for this, scaleless dummy",
    run: async (page: Page) => {
      const postSelectors = [
        'button.share-actions__primary-action',
        'button:has-text("Post")',
      ];
      for (const sel of postSelectors) {
        const el = page.locator(sel).first();
        if (await el.count()) {
          await el.click({ timeout: 3000 }).catch(() => {});
          break;
        }
      }
      await page.waitForTimeout(3000);
    },
  },
];
