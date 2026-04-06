/**
 * 注册后处理模块
 * 负责处理注册完成后的引导页、偏好设置等
 */

import type { Page } from "@playwright/test";
import { dismissPostRegistrationOnboarding } from "../../../src/stealth/post-registration-handler";
import { humanDelay } from "../../../src/stealth/advanced-stealth";

/**
 * 处理注册后的引导流程
 */
export async function handlePostRegistration(page: Page): Promise<void> {
  console.log(`[Flow] Checking post-registration onboarding on page: ${page.url()}`);

  const handledPostRegistrationOnboarding =
    await dismissPostRegistrationOnboarding(page);

  if (handledPostRegistrationOnboarding) {
    console.log(
      `[Flow] Post-registration onboarding handled, current URL: ${page.url()}`
    );
    await humanDelay(1000, 1500);
  }
}

/**
 * 等待页面跳转并处理引导页
 */
export async function waitAndHandlePostRegistration(page: Page): Promise<void> {
  // 等待页面跳转到主页
  await humanDelay(3000, 5000);
  console.log(`[Flow] Current URL: ${page.url()}`);

  // 注册完成后可能出现偏好页/引导页，优先点击 Skip
  await dismissPostRegistrationOnboarding(page);
}
