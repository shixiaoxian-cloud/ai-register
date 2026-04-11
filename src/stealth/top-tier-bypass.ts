import type { BrowserContext, Page } from "@playwright/test";

import { requireBrowserEnvironment } from "../env";
import {
  applyBrowserEnvironmentToContext,
  applyBrowserEnvironmentToPage
} from "./advanced-stealth";

function buildClientHintHeaders() {
  const browserEnvironment = requireBrowserEnvironment();
  const userAgentMetadata = browserEnvironment.userAgentMetadata || {};
  const brands = Array.isArray(userAgentMetadata.brands)
    ? userAgentMetadata.brands
    : [];
  const fullVersionList = Array.isArray(userAgentMetadata.fullVersionList)
    ? userAgentMetadata.fullVersionList
    : [];

  const secChUa = brands
    .map((item) => `"${item.brand}";v="${item.version}"`)
    .join(", ");
  const secChUaFullVersionList = fullVersionList
    .map((item) => `"${item.brand}";v="${item.version}"`)
    .join(", ");

  return {
    "sec-ch-ua": secChUa,
    "sec-ch-ua-mobile": userAgentMetadata.mobile ? "?1" : "?0",
    "sec-ch-ua-platform": userAgentMetadata.platform
      ? `"${userAgentMetadata.platform}"`
      : "",
    "sec-ch-ua-platform-version": userAgentMetadata.platformVersion
      ? `"${userAgentMetadata.platformVersion}"`
      : "",
    "sec-ch-ua-arch": userAgentMetadata.architecture
      ? `"${userAgentMetadata.architecture}"`
      : "",
    "sec-ch-ua-bitness": userAgentMetadata.bitness
      ? `"${userAgentMetadata.bitness}"`
      : "",
    "sec-ch-ua-model": userAgentMetadata.model ? `"${userAgentMetadata.model}"` : '""',
    "sec-ch-ua-full-version-list": secChUaFullVersionList
  };
}

export async function fixClientHints(context: BrowserContext): Promise<void> {
  const browserEnvironment = requireBrowserEnvironment();
  const headers = {
    ...buildClientHintHeaders(),
    "accept-language": browserEnvironment.locale
  };

  await context.setExtraHTTPHeaders(
    Object.fromEntries(
      Object.entries(headers).filter(([, value]) => String(value || "").trim())
    )
  );
}

export async function deepJavaScriptFix(_page: Page): Promise<void> {
  // 浏览器环境配置不允许注入 stealth 或深度指纹篡改脚本。
}

export async function setupTopTierAntiDetection(
  page: Page,
  context: BrowserContext
): Promise<void> {
  const browserEnvironment = requireBrowserEnvironment();
  await fixClientHints(context);
  await applyBrowserEnvironmentToContext(context, {
    userAgent: browserEnvironment.userAgent,
    uaCH: buildClientHintHeaders()["sec-ch-ua"],
    locale: browserEnvironment.locale,
    timezone: browserEnvironment.timezone,
    viewportWidth: Number(browserEnvironment.viewport.width || 1440),
    viewportHeight: Number(browserEnvironment.viewport.height || 900),
    screenWidth: Number(browserEnvironment.screen.width || browserEnvironment.viewport.width || 1440),
    screenHeight: Number(browserEnvironment.screen.height || browserEnvironment.viewport.height || 900),
    geolocation: browserEnvironment.geolocation
      ? {
          latitude: Number(browserEnvironment.geolocation.latitude),
          longitude: Number(browserEnvironment.geolocation.longitude),
          accuracy: Number(browserEnvironment.geolocation.accuracy || 100)
        }
      : undefined,
    browserVersion: browserEnvironment.browserVersion
  });
  await applyBrowserEnvironmentToPage(page, {
    userAgent: browserEnvironment.userAgent,
    uaCH: buildClientHintHeaders()["sec-ch-ua"],
    locale: browserEnvironment.locale,
    timezone: browserEnvironment.timezone,
    viewportWidth: Number(browserEnvironment.viewport.width || 1440),
    viewportHeight: Number(browserEnvironment.viewport.height || 900),
    screenWidth: Number(browserEnvironment.screen.width || browserEnvironment.viewport.width || 1440),
    screenHeight: Number(browserEnvironment.screen.height || browserEnvironment.viewport.height || 900),
    geolocation: browserEnvironment.geolocation
      ? {
          latitude: Number(browserEnvironment.geolocation.latitude),
          longitude: Number(browserEnvironment.geolocation.longitude),
          accuracy: Number(browserEnvironment.geolocation.accuracy || 100)
        }
      : undefined,
    browserVersion: browserEnvironment.browserVersion
  });
  await deepJavaScriptFix(page);
}
