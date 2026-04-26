import { chromium, type BrowserContext, type Page } from "playwright";
import { resolve } from "node:path";

let context: BrowserContext | null = null;

/**
 * Launch (or reuse) a single headed persistent Chromium profile and hand back
 * a fresh page. Headed because the laptop's screen IS the demo — the audience
 * watches Chrome navigate and type.
 *
 * Uses a persistent user-data-dir so cookies/sessions survive restarts. Log
 * into LinkedIn, X, Instagram, etc. ONCE in this profile (override the path
 * with PW_PROFILE_DIR) and the agent stays logged in across calls.
 */
export async function getPage(): Promise<Page> {
  if (!context) {
    const userDataDir = process.env.PW_PROFILE_DIR
      ? resolve(process.env.PW_PROFILE_DIR)
      : resolve(process.cwd(), ".pw-profile");

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      viewport: null,
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });
  }
  // Reuse the first tab if it's the only blank one, otherwise open a new tab.
  const pages = context.pages();
  if (pages.length === 1 && pages[0].url() === "about:blank") {
    return pages[0];
  }
  return await context.newPage();
}

export async function closeBrowser(): Promise<void> {
  await context?.close().catch(() => {});
  context = null;
}
