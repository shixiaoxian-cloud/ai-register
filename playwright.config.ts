import { existsSync } from "node:fs";

import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import {
  readActivePlatformContext,
  type PlatformBrowserEnvironmentConfig
} from "./src/config/platform-sqlite";

dotenv.config({ quiet: true });

const headed = process.env.HEADED === "true" || process.env.HEADED === "1";

const knownLocalBrowsers = {
  chrome: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ],
  msedge: [
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ]
} as const;

function resolveLocalBrowserPath(): string | undefined {
  const explicitPath = process.env.BROWSER_EXECUTABLE_PATH?.trim();
  if (explicitPath) {
    return explicitPath;
  }

  const preferred = process.env.LOCAL_BROWSER_NAME?.trim().toLowerCase();
  const orderedBrowserNames = preferred
    ? [preferred, "chrome", "msedge"]
    : ["chrome", "msedge"];

  for (const browserName of orderedBrowserNames) {
    const candidatePaths =
      knownLocalBrowsers[browserName as keyof typeof knownLocalBrowsers] ?? [];

    for (const candidatePath of candidatePaths) {
      if (existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return undefined;
}

const localBrowserPath = resolveLocalBrowserPath();
let activeBrowserEnvironmentConfig: PlatformBrowserEnvironmentConfig | null = null;

try {
  activeBrowserEnvironmentConfig =
    readActivePlatformContext().browserEnvironmentConfig;
} catch {
  activeBrowserEnvironmentConfig = null;
}

function buildDefaultHeaders() {
  const userAgentMetadata =
    activeBrowserEnvironmentConfig?.userAgentMetadata || {};
  const brands = Array.isArray(userAgentMetadata.brands)
    ? userAgentMetadata.brands
    : [];
  const secChUa = brands
    .map(
      (item: { brand: string; version: string }) =>
        `"${item.brand}";v="${item.version}"`
    )
    .join(", ");

  return {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language":
      activeBrowserEnvironmentConfig?.locale || "en-US,en;q=0.9",
    "Sec-Ch-Ua":
      secChUa || '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    "Sec-Ch-Ua-Mobile": userAgentMetadata.mobile ? "?1" : "?0",
    "Sec-Ch-Ua-Platform": userAgentMetadata.platform
      ? `"${userAgentMetadata.platform}"`
      : '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1"
  };
}

const viewportWidth = Number(
  activeBrowserEnvironmentConfig?.viewport?.width || 1440
);
const viewportHeight = Number(
  activeBrowserEnvironmentConfig?.viewport?.height || 900
);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 5 * 60 * 1000,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }]
  ],
  use: {
    browserName: "chromium",
    headless: !headed,
    locale:
      process.env.BROWSER_LOCALE ??
      activeBrowserEnvironmentConfig?.locale ??
      "en-US",
    timezoneId:
      process.env.BROWSER_TIMEZONE ??
      activeBrowserEnvironmentConfig?.timezone ??
      "America/Los_Angeles",
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: {
      width: viewportWidth,
      height: viewportHeight
    },
    extraHTTPHeaders: buildDefaultHeaders(),
    userAgent:
      process.env.BROWSER_USER_AGENT ??
      activeBrowserEnvironmentConfig?.userAgent ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    launchOptions: {
      executablePath: localBrowserPath,
      args: [
        "--disable-blink-features=AutomationControlled"
      ]
    }
  }
});
