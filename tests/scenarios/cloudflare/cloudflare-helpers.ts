/**
 * Cloudflare 绕过模块
 * 负责 Cloudflare 验证和绕过逻辑
 */

import type { Page, BrowserContext } from "@playwright/test";
import {
  bypassCloudflare,
  detectCloudflareBlock,
  waitForPageLoad
} from "../../../src/stealth/expert-bypass";
import { humanDelay } from "../../../src/stealth/advanced-stealth";

/**
 * 检查 URL 是否需要 Cloudflare 绕过
 */
export function needsCloudflareBypass(url: string): boolean {
  const targetUrl = new URL(url);
  return targetUrl.host.includes('chatgpt.com') || targetUrl.host.includes('openai.com');
}

/**
 * 执行 Cloudflare 绕过流程
 */
export async function performCloudflareBypass(
  page: Page,
  context: BrowserContext,
  startUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!needsCloudflareBypass(startUrl)) {
    // 非 ChatGPT 站点，直接访问
    await humanDelay(1000, 2000);
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageLoad(page);
    return { success: true };
  }

  console.log('[Expert] Using expert-level Cloudflare bypass...');
  const bypassSuccess = await bypassCloudflare(page, context, startUrl);

  if (!bypassSuccess) {
    return {
      success: false,
      error: "Cloudflare 高级验证失败，页面被拦截"
    };
  }

  console.log('[Expert] ✓ Cloudflare bypass successful');

  // 检查是否仍然被拦截
  const isBlocked = await detectCloudflareBlock(page);
  if (isBlocked) {
    return {
      success: false,
      error: "目标页面仍然被 Cloudflare 拦截"
    };
  }

  return { success: true };
}
