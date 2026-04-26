import type { ScriptedStep } from "./index.js";
import type { Page } from "playwright";

// LinkedIn — open the feed, click "Start a post", and ship a desperate
// "please hire me" post. Audience watches the cringe go live.

const POST = `🙏 I know this is unsolicited but I just lost my job and I would absolutely CRUSH any role you have open. 12+ years of experience, willing to relocate anywhere, willing to take a pay cut, willing to work nights/weekends. DM me. Open to anything. PLEASE. #OpenToWork #Hireme #DesperateButCapable`;

export const steps: ScriptedStep[] = [
  {
    detail: "opening LinkedIn — the council recommends you do not do this",
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
      await page
        .locator('div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]')
        .first()
        .waitFor({ timeout: 10_000 });
      await page.waitForTimeout(800);
    },
  },
  {
    detail: "typing the desperate post, scaleless dummy",
    run: async (page: Page) => {
      const editor = page
        .locator('div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]')
        .first();
      await editor.click();
      await page.keyboard.type(POST, { delay: 4 });
      await page.waitForTimeout(1500);
    },
  },
  {
    detail: "clicking Post — there is no undo for this, you muppet",
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
