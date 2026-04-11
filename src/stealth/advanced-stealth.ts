import type { BrowserContext, Page } from "@playwright/test";

interface BrowserEnvironmentFields {
  userAgent: string;
  uaCH?: string;
  locale: string;
  timezone: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  browserVersion: string;
  extraHeaders?: Record<string, string>;
}

function buildExtraHeaders(fields: BrowserEnvironmentFields) {
  const base: Record<string, string> = {
    "User-Agent": fields.userAgent,
    "Accept-Language": fields.locale
  };

  if (fields.uaCH) {
    base["Sec-CH-UA"] = fields.uaCH;
  }

  return {
    ...base,
    ...(fields.extraHeaders ?? {})
  };
}

export async function applyBrowserEnvironmentToContext(
  context: BrowserContext,
  fields: BrowserEnvironmentFields
): Promise<void> {
  if (fields.geolocation) {
    await context.setGeolocation({
      latitude: fields.geolocation.latitude,
      longitude: fields.geolocation.longitude,
      accuracy: fields.geolocation.accuracy ?? 100
    });
  }

  const headers = buildExtraHeaders(fields);
  await context.setExtraHTTPHeaders(headers);
}

export async function applyBrowserEnvironmentToPage(
  page: Page,
  fields: BrowserEnvironmentFields
): Promise<void> {
  await page.setViewportSize({
    width: fields.viewportWidth,
    height: fields.viewportHeight
  });

  await applyBrowserEnvironmentToContext(page.context(), fields);
}

export async function injectAdvancedStealthScripts(page: Page): Promise<void> {
  // Intentionally left blank to avoid reintroducing prohibited stealth heuristics.
  return;
}

export async function humanDelay(min = 500, max = 1200): Promise<void> {
  const ms = Math.random() * (max - min) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function humanMouseMove(page: Page): Promise<void> {
  const x = Math.random() * 300 + 100;
  const y = Math.random() * 300 + 100;
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
  await humanDelay(100, 400);
}

export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const element = page.locator(selector);
  await element.click({ timeout: 3000 }).catch(() => element.click({ force: true }));
  for (const char of text) {
    await element.press(char, { delay: Math.random() * 60 + 40 });
  }
}

export async function setupRealisticFingerprint(context: BrowserContext): Promise<void> {
  // No stealth heuristics are permitted; keep compatibility by providing a stub.
  return;
}
