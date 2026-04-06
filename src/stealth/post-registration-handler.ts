import type { Page } from "@playwright/test";

import { humanDelay, humanMouseMove, humanType } from "./advanced-stealth";

const postRegistrationSkipSelector = [
  'button:has-text("Skip"):not([data-skip-to-content])',
  'button:has-text("跳过"):not([data-skip-to-content])',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  // Only match Skip links that are NOT accessibility links
  'a:has-text("Skip"):not([data-skip-to-content]):not([href="#main"])',
  'a:has-text("跳过"):not([data-skip-to-content]):not([href="#main"])'
].join(", ");

/**
 * 处理注册后可能出现的引导页面（工作账号选择、Skip 按钮、工作区名称输入等）
 *
 * @param page - Playwright Page 对象
 * @returns 是否跳过了任何引导页面
 */
export async function dismissPostRegistrationOnboarding(page: Page): Promise<boolean> {
  let skippedAny = false;

  // 检查是否在 create-free-workspace 页面，如果是则直接跳转到主页
  const currentUrl = page.url();
  if (currentUrl.includes('chatgpt.com/create-free-workspace')) {
    console.log('[Flow] Detected create-free-workspace page, redirecting to home page');
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(2000, 3000);
    console.log('[Flow] Redirected to ChatGPT home page');
    return true;
  }

  // 尝试多次跳过，因为可能有多个引导页
  for (let attempt = 1; attempt <= 6; attempt++) {
    // 在每次循环中检查是否跳转到了 create-free-workspace 页面
    const loopUrl = page.url();
    if (loopUrl.includes('chatgpt.com/create-free-workspace')) {
      console.log('[Flow] Detected create-free-workspace page in loop, redirecting to home page');
      await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
      console.log('[Flow] Redirected to ChatGPT home page');
      return true;
    }

    // 首先检查是否有工作账号选择页面（多种选择器）
    const personalAccountSelectors = [
      'a:has-text("Start a personal account")',
      'a:has-text("start a personal account")',
      'a[href*="personal"]',
      'button:has-text("For my own work tasks")',
      'button[value="personal"]'
    ];

    let personalAccountLink = null;
    let personalAccountVisible = false;

    for (const selector of personalAccountSelectors) {
      const link = page.locator(selector).first();
      const visible = await link.isVisible().catch(() => false);
      if (visible) {
        personalAccountLink = link;
        personalAccountVisible = true;
        console.log(`[Flow] Found personal account selector: ${selector}`);
        break;
      }
    }

    if (personalAccountVisible && personalAccountLink) {
      console.log('[Flow] Work account selection page detected, clicking personal account option');
      await humanDelay(500, 1000);
      await humanMouseMove(page);

      try {
        await personalAccountLink.click({ timeout: 5000 });
      } catch (error) {
        console.log('[Flow] Regular click failed, trying force click...');
        await personalAccountLink.click({ force: true });
      }

      await humanDelay(2000, 3000);
      console.log('[Flow] Personal account option clicked, waiting for the next page');
      skippedAny = true;
      continue;
    }

    // 然后检查常规的 Skip 按钮
    const skipButton = page.locator(postRegistrationSkipSelector).first();
    const skipVisible = await skipButton.isVisible().catch(() => false);

    console.log(`[Flow] Skip button visible (attempt ${attempt}): ${skipVisible}`);

    if (skipVisible) {
      console.log('[Flow] Preference/onboarding page detected, clicking Skip button');
      await humanDelay(500, 1000);
      await humanMouseMove(page);

      // Try regular click first, then force click if intercepted
      try {
        await skipButton.click({ timeout: 5000 });
      } catch (error) {
        console.log('[Flow] Regular click failed, trying force click...');
        await skipButton.click({ force: true });
      }

      await humanDelay(2000, 3000);
      console.log('[Flow] Skip button clicked, waiting for the next page');
      skippedAny = true;

      // 继续检查是否还有更多 Skip 按钮
      continue;
    }

    // 检查是否有工作区名称输入页面
    const workspaceNameSelectors = [
      'input[name="workspace-name"]',
      '[data-testid="workspace-name-input"]',
      'input[placeholder*="Acme Inc"]',
      'input[placeholder*="workspace"]',
      'input[placeholder*="Workspace"]'
    ];

    let workspaceNameInput = null;
    let workspaceNameVisible = false;

    for (const selector of workspaceNameSelectors) {
      const input = page.locator(selector).first();
      const visible = await input.isVisible().catch(() => false);
      if (visible) {
        workspaceNameInput = input;
        workspaceNameVisible = true;
        console.log(`[Flow] Found workspace name input: ${selector}`);
        break;
      }
    }

    if (workspaceNameVisible && workspaceNameInput) {
      console.log('[Flow] Workspace name page detected, filling and clicking Continue');
      await humanDelay(500, 1000);
      await humanMouseMove(page);

      // 检查输入框是否已有默认值
      const currentValue = await workspaceNameInput.inputValue().catch(() => '');
      console.log(`[Flow] Current workspace name value: "${currentValue}"`);

      // 如果没有值或值为空，填入默认名称
      if (!currentValue || currentValue.trim() === '') {
        // 使用已经找到的 workspaceNameInput，而不是重新查找
        await workspaceNameInput.fill('My Workspace');
        console.log('[Flow] Workspace name filled: "My Workspace"');
      } else {
        console.log('[Flow] Using existing workspace name');
      }

      // 查找 Continue 按钮
      const continueButtonSelectors = [
        'button:has-text("Continue")',
        'button[type="submit"]:has-text("Continue")',
        'button.btn-primary:has-text("Continue")',
        'button[class*="primary"]:has-text("Continue")'
      ];

      let continueButton = null;
      for (const selector of continueButtonSelectors) {
        const btn = page.locator(selector).first();
        const visible = await btn.isVisible().catch(() => false);
        if (visible) {
          continueButton = btn;
          console.log(`[Flow] Found Continue button: ${selector}`);
          break;
        }
      }

      if (continueButton) {
        await humanDelay(500, 1000);
        await humanMouseMove(page);

        try {
          await continueButton.click({ timeout: 5000 });
        } catch (error) {
          console.log('[Flow] Regular click failed, trying force click...');
          await continueButton.click({ force: true });
        }

        await humanDelay(2000, 3000);
        console.log('[Flow] Continue button clicked, waiting for the next page');
        skippedAny = true;
        continue;
      } else {
        console.log('[Flow] ⚠ Workspace name input found but no Continue button detected');
      }
    }

    // 检查是否有 "Okay, let's go" 按钮（在点击 Skip 后可能出现）
    const okayLetsGoSelectors = [
      'button[data-testid="getting-started-button"]',
      'button:has-text("Okay, let\'s go")',
      'button.btn-primary:has-text("Okay")',
      'button:has(div:has-text("Okay, let\'s go"))'
    ];

    let okayButton = null;
    let okayButtonVisible = false;

    for (const selector of okayLetsGoSelectors) {
      const btn = page.locator(selector).first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        okayButton = btn;
        okayButtonVisible = true;
        console.log(`[Flow] Found "Okay, let's go" button: ${selector}`);
        break;
      }
    }

    if (okayButtonVisible && okayButton) {
      console.log('[Flow] "Okay, let\'s go" button detected, clicking to proceed');
      await humanDelay(500, 1000);
      await humanMouseMove(page);

      try {
        await okayButton.click({ timeout: 5000 });
      } catch (error) {
        console.log('[Flow] Regular click failed, trying force click...');
        await okayButton.click({ force: true });
      }

      await humanDelay(2000, 3000);
      console.log('[Flow] "Okay, let\'s go" button clicked, waiting for the next page');
      skippedAny = true;
      continue;
    }

    // 如果没有 Skip 按钮或工作区页面，等待一下再检查
    await humanDelay(1500, 2500);
  }

  return skippedAny;
}
