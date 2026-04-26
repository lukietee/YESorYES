import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

/**
 * Launch (or reuse) a single headed Chromium instance and hand back a fresh
 * page. Headed because the laptop's screen IS the demo — the audience watches
 * Chrome navigate and type.
 */
export async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    });
  }
  if (!context) {
    context = await browser.newContext({
      viewport: null,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    });
  }
  return await context.newPage();
}

export async function closeBrowser(): Promise<void> {
  await context?.close().catch(() => {});
  context = null;
  await browser?.close().catch(() => {});
  browser = null;
}
