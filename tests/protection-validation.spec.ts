import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { getConfiguredStartUrl } from "../src/config/target-site";
import { requireEnv, runtimeConfig, tempMailConfig } from "../src/env";
import {
  createTempMailService,
  type Mailbox,
  type TempMailService
} from "../src/email/temp-mail";
import { waitForKnownOutcome, waitForManualClearance } from "../src/protection";
import {
  humanDelay,
  humanMouseMove,
  humanType
} from "../src/stealth/advanced-stealth";
import {
  setupTopTierAntiDetection
} from "../src/stealth/top-tier-bypass";
import targetProfile from "../src/target.profile";
import type {
  FlowStage,
  OutcomeKind,
  OutcomeRecord
} from "../src/types";
import type { Page } from "@playwright/test";
import { generateUserRegistrationInfo } from "../src/utils/user-info-generator";
import { generateEmailLocalPart } from "../src/utils/email-generator";
import { aggregateSub2ApiFiles } from "../src/utils/sub2api-aggregator";

// 导入通用模块
import {
  RetryableRegistrationFailure,
  throwIfRegistrationFailed
} from "./common/error-handling";
import {
  recordOutcome,
  attachSummary
} from "./common/outcome-recorder";
import {
  isPreAuthChallengePage
} from "./common/page-helpers";

// 导入场景模块
import {
  waitForVerificationCodeWithRetry,
  submitEmailVerificationCode
} from "./scenarios/email-verification/email-helpers";
import {
  performCloudflareBypass
} from "./scenarios/cloudflare/cloudflare-helpers";
import {
  fillAccountDetails,
  needsAccountDetails
} from "./scenarios/account-details/account-helpers";
import {
  extractAndSaveTokens
} from "./scenarios/token-extraction/token-helpers";
import {
  handlePostRegistration,
  waitAndHandlePostRegistration
} from "./scenarios/post-registration/post-registration-helpers";

const registrationRetryAttempts = Number(
  process.env.REGISTRATION_RETRY_ATTEMPTS ?? "2"
);
const emailCodeLookbackWindowMs = 5_000;

test.describe.configure({ retries: registrationRetryAttempts });

const postRegistrationSkipSelector = [
  'button:has-text("Skip"):not([data-skip-to-content])',
  'button:has-text("跳过"):not([data-skip-to-content])',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  // Only match Skip links that are NOT accessibility links
  'a:has-text("Skip"):not([data-skip-to-content]):not([href="#main"])',
  'a:has-text("跳过"):not([data-skip-to-content]):not([href="#main"])'
].join(", ");

async function waitForKnownOutcomeWithFailureHandling(
  page: Page,
  selectors: typeof targetProfile.selectors,
  timeoutMs: number,
  stage: FlowStage,
  summary: OutcomeRecord[],
  testInfo: TestInfo
): Promise<Awaited<ReturnType<typeof waitForKnownOutcome>>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await throwIfRegistrationFailed(page, stage, summary, testInfo);

    const outcome = await waitForKnownOutcome(page, selectors, 1_000);
    if (outcome.kind !== "unknown") {
      return outcome;
    }
  }

  await throwIfRegistrationFailed(page, stage, summary, testInfo);

  return {
    kind: "unknown",
    details: `在 ${timeoutMs}ms 内没有出现已配置的成功标记、阻断页、验证码输入框或安全挑战。`
  };
}

async function dismissPostRegistrationOnboarding(page: Page): Promise<boolean> {
  let skippedAny = false;

  // 尝试多次跳过，因为可能有多个引导页
  for (let attempt = 1; attempt <= 6; attempt++) {
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

    // 如果没有 Skip 按钮，等待一下再检查
    await humanDelay(1500, 2500);
  }

  return skippedAny;
}

test("验证已授权目标站点的保护流程", async ({ page, context }, testInfo) => {
  console.log(
    `[Run] Starting registration attempt ${testInfo.retry + 1} / ${registrationRetryAttempts + 1}`
  );

  const summary: OutcomeRecord[] = [];
  const startUrl = getConfiguredStartUrl();
  const permissionOrigin =
    targetProfile.permissionOrigin ?? new URL(startUrl).origin;
  let finalOutcomeKind: OutcomeKind | null = null;

  // 生成用户注册信息
  const userInfo = generateUserRegistrationInfo();
  console.log(`[UserInfo] Generated user info:`, {
    firstName: userInfo.firstName,
    lastName: userInfo.lastName,
    birthday: userInfo.birthday,
    password: userInfo.password.substring(0, 4) + '****' // 只显示前4个字符
  });

  // 将生成的密码设置为环境变量
  process.env.TARGET_PASSWORD = userInfo.password;

  // 临时邮箱服务（如果启用）
  let tempMailService: ReturnType<typeof createTempMailService> | null = null;
  let tempMailbox: Mailbox | null = null;

  try {
    // 如果使用临时邮箱，先创建邮箱
    if (runtimeConfig.useTempMail) {
      tempMailService = createTempMailService(
        tempMailConfig.baseUrl,
        tempMailConfig.apiKey
      );
      // 使用自动生成的邮箱本地部分
      const emailLocal = generateEmailLocalPart();
      const mailbox = await tempMailService.createMailbox(emailLocal);
      tempMailbox = mailbox;
      console.log(`[TempMail] Created temporary email: ${mailbox.full_address}`);

      // 将临时邮箱地址设置为环境变量，供后续使用
      process.env.TARGET_EMAIL = mailbox.full_address;
    }

    // 使用顶级反检测方案
    console.log('[TopTier] Setting up top-tier anti-detection...');
    await setupTopTierAntiDetection(page, context);

    if (targetProfile.grantedPermissions?.length) {
      await page
        .context()
        .grantPermissions(targetProfile.grantedPermissions, {
          origin: permissionOrigin
        });
    }

    // 使用 Cloudflare 绕过场景模块
    const bypassResult = await performCloudflareBypass(page, context, startUrl);

    if (!bypassResult.success) {
      recordOutcome(
        summary,
        "before_login",
        "blocked",
        bypassResult.error || "Cloudflare 验证失败",
        page
      );

      await page.screenshot({
        path: testInfo.outputPath("cloudflare-blocked.png"),
        fullPage: true
      });

      throw new Error(
        bypassResult.error || "Cloudflare 验证失败。" +
        "建议：1) 使用真实浏览器 Profile；2) 检查网络设置；3) 尝试住宅代理。"
      );
    }

    if (await isPreAuthChallengePage(page)) {
      recordOutcome(
        summary,
        "before_login",
        "pre_auth_challenge",
        "登录前先进入了安全检查页，登录按钮尚未渲染。",
        page
      );

      await page.screenshot({
        path: testInfo.outputPath("pre-auth-challenge.png"),
        fullPage: true
      });

      if (runtimeConfig.continueAfterProtectedChallenge) {
        await waitForManualClearance(
          "站点在登录前展示了安全检查页，登录按钮尚未出现。请先手动完成该挑战，再按回车继续。",
          runtimeConfig.manualStepTimeoutMs
        );
      } else {
        throw new Error(
          "页面当前处于登录前安全检查页（例如“请稍候…”），因此登录按钮还未渲染。请手动完成挑战，或开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true 后再运行。"
        );
      }
    }

    const activePage = (await targetProfile.prepare?.(page)) ?? page;

    // 简化的人类行为模拟
    console.log('[Human Behavior] Simulating user on login page...');
    await humanDelay(1000, 2000);

    // 快速移动鼠标
    await humanMouseMove(activePage);
    await humanDelay(500, 1000);

    // 填写邮箱
    await humanType(activePage, targetProfile.selectors.email, requireEnv("TARGET_EMAIL"));

    let passwordFilled = false;
    if (targetProfile.selectors.password) {
      const passwordField = activePage.locator(targetProfile.selectors.password).first();
      const passwordVisible = await passwordField.isVisible().catch(() => false);

      if (passwordVisible) {
        await humanDelay(300, 600);
        await humanType(activePage, targetProfile.selectors.password, requireEnv("TARGET_PASSWORD"));
        passwordFilled = true;
      }
    }

    await targetProfile.fillOptionalFields?.(activePage);

    // 点击提交
    await humanDelay(500, 1000);
    await activePage.locator(targetProfile.selectors.submit).click();
    await throwIfRegistrationFailed(activePage, "email_submitted", summary, testInfo);

    let outcomeStage: FlowStage = passwordFilled
      ? "credentials_submitted"
      : "email_submitted";

    // 提交后，检测下一步是什么：密码输入 或 验证码输入
    console.log('[Flow] Detecting next step after email submission...');

    // 等待页面响应（密码框、验证码框或其他结果）
    await humanDelay(2000, 3000);

    // 检查是否出现验证码输入框
    const codeInputAppeared = targetProfile.selectors.emailCodeInput
      ? await activePage
          .locator(targetProfile.selectors.emailCodeInput)
          .first()
          .isVisible()
          .catch(() => false)
      : false;

    if (codeInputAppeared) {
      console.log('[Flow] Email verification code input detected');
      outcomeStage = "email_submitted";
      const emailVerification = targetProfile.emailVerification;

      // 直接跳转到验证码处理流程
      if (!emailVerification?.enabled) {
        throw new Error(
          "页面要求输入邮箱验证码，但 target.profile 中未启用 emailVerification。"
        );
      }

      const emailCodeRequestedAt = new Date(Date.now() - emailCodeLookbackWindowMs);
      const code = await waitForVerificationCodeWithRetry({
        page: activePage,
        receivedAfter: emailCodeRequestedAt,
        tempMailService,
        tempMailbox,
        emailVerification
      });
      await submitEmailVerificationCode(activePage, code);

      // 验证码提交后，再次检查是否需要输入密码
      console.log(`[Flow] Waiting after verification code submission...`);
      await humanDelay(2000, 3000);

      const passwordAfterCode = await activePage
        .locator(targetProfile.selectors.password ?? "input[type='password']")
        .first()
        .isVisible()
        .catch(() => false);

      if (passwordAfterCode) {
        console.log('[Flow] Password input detected after email verification');
        await humanDelay(500, 1000);
        await humanType(activePage, targetProfile.selectors.password ?? "input[type='password']", requireEnv("TARGET_PASSWORD"));
        passwordFilled = true;

        await targetProfile.fillOptionalFields?.(activePage);
        await humanDelay(500, 1200);
        await humanMouseMove(activePage);
        await activePage.locator(targetProfile.selectors.submit).click();
        await throwIfRegistrationFailed(activePage, "password_submitted", summary, testInfo);
        outcomeStage = "password_submitted";
      } else {
        outcomeStage = "email_verification_submitted";
      }
    } else if (!passwordFilled) {
      // 检查是否出现密码输入框
      console.log('[Flow] Checking for password input...');
      const passwordAppeared = await activePage
        .locator(targetProfile.selectors.password ?? "input[type='password']")
        .first()
        .waitFor({
          state: "visible",
          timeout: 5_000
        })
        .then(() => true)
        .catch(() => false);

      if (passwordAppeared) {
        console.log('[Flow] Password input detected');
        await humanDelay(500, 1000);
        await humanType(activePage, targetProfile.selectors.password ?? "input[type='password']", requireEnv("TARGET_PASSWORD"));
        passwordFilled = true;

        await targetProfile.fillOptionalFields?.(activePage);
        await humanDelay(500, 1200);
        await humanMouseMove(activePage);
        await activePage.locator(targetProfile.selectors.submit).click();
        await throwIfRegistrationFailed(activePage, "password_submitted", summary, testInfo);
        outcomeStage = "password_submitted";
      }
    }

    let outcome = await waitForKnownOutcomeWithFailureHandling(
      activePage,
      targetProfile.selectors,
      30_000,
      outcomeStage,
      summary,
      testInfo
    );
    recordOutcome(summary, outcomeStage, outcome.kind, outcome.details, activePage);
    finalOutcomeKind = outcome.kind;

    // 如果仍然需要验证码（通过 waitForKnownOutcome 检测到）
    if (outcome.kind === "email_code_requested") {
      console.log('[Flow] Email verification code requested (detected by waitForKnownOutcome)');
      const emailVerification = targetProfile.emailVerification;

      if (!emailVerification?.enabled) {
        throw new Error(
          "页面要求输入邮箱验证码，但 target.profile 中未启用 emailVerification。"
        );
      }

      if (!targetProfile.selectors.emailCodeInput) {
        throw new Error("启用邮箱验证码流程时，必须配置 emailCodeInput 选择器。");
      }

      const emailCodeRequestedAt = new Date(Date.now() - emailCodeLookbackWindowMs);
      const code = await waitForVerificationCodeWithRetry({
        page: activePage,
        receivedAfter: emailCodeRequestedAt,
        tempMailService,
        tempMailbox,
        emailVerification
      });
      await submitEmailVerificationCode(activePage, code);
      outcome = await waitForKnownOutcomeWithFailureHandling(
        activePage,
        targetProfile.selectors,
        30_000,
        "email_verification_submitted",
        summary,
        testInfo
      );
      recordOutcome(
        summary,
        "email_verification_submitted",
        outcome.kind,
        outcome.details,
        activePage
      );
      finalOutcomeKind = outcome.kind;
    }

    // 检查是否需要填写账户资料
    await humanDelay(2000, 3000);

    console.log(`[Flow] Checking post-registration onboarding on page: ${activePage.url()}`);
    await handlePostRegistration(activePage);

    const needs = await needsAccountDetails(activePage);

    if (needs.fullName || needs.age || needs.birthday) {
      await fillAccountDetails(activePage, userInfo);

      await throwIfRegistrationFailed(
        activePage,
        "after_manual_challenge",
        summary,
        testInfo
      );

      // 等待页面跳转并处理引导页
      await waitAndHandlePostRegistration(activePage);

      // 等待最终结果
      console.log(`[Flow] Checking for success indicators on page: ${activePage.url()}`);
      outcome = await waitForKnownOutcomeWithFailureHandling(
        activePage,
        targetProfile.selectors,
        30_000,
        "after_manual_challenge",
        summary,
        testInfo
      );
      console.log(`[Flow] Final outcome detected: ${outcome.kind}`);
      recordOutcome(
        summary,
        "after_manual_challenge",
        outcome.kind,
        outcome.details,
        activePage
      );
      finalOutcomeKind = outcome.kind;
    }

    if (
      runtimeConfig.continueAfterProtectedChallenge &&
      (outcome.kind === "captcha" ||
        outcome.kind === "sms_challenge" ||
        outcome.kind === "device_challenge")
    ) {
      await activePage.screenshot({
        path: testInfo.outputPath(`${outcome.kind}-challenge.png`),
        fullPage: true
      });

      await waitForManualClearance(
        `当前已触发 ${outcome.kind}。如果你的测试计划允许继续，请手动完成该验证后再恢复执行。`,
        runtimeConfig.manualStepTimeoutMs
      );

      outcome = await waitForKnownOutcomeWithFailureHandling(
        activePage,
        targetProfile.selectors,
        30_000,
        "after_manual_challenge",
        summary,
        testInfo
      );
      recordOutcome(
        summary,
        "after_manual_challenge",
        outcome.kind,
        outcome.details,
        activePage
      );
      finalOutcomeKind = outcome.kind;
    }

    expect(targetProfile.expectedOutcomes).toContain(finalOutcomeKind ?? "unknown");

    // 允许 chatgpt.com 落地页作为 success 识别失败时的兜底，避免漏掉已登录态的 token 提取
    // 同时也允许工作区创建页面作为成功标记
    const shouldExtractTokens =
      finalOutcomeKind === "success" ||
      (finalOutcomeKind === "unknown" &&
       (activePage.url().includes("chatgpt.com") ||
        activePage.url().includes("create-free-workspace")));

    if (shouldExtractTokens) {
      await extractAndSaveTokens(activePage, testInfo, userInfo, tempMailbox);
    } else {
      console.log(
        `[Token] Skipping token extraction because final outcome is ${finalOutcomeKind ?? "unknown"}`
      );
    }
  } finally {
    await attachSummary(summary, testInfo);

    // 清理临时邮箱（可通过环境变量控制是否保留）
    if (tempMailService && tempMailbox && runtimeConfig.useTempMail) {
      const keepMailbox = process.env.KEEP_TEMP_MAILBOX === "true";
      if (keepMailbox) {
        console.log(`[TempMail] Keeping temporary mailbox: ${tempMailbox.full_address}`);
        console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
      } else {
        try {
          await tempMailService.deleteMailbox(tempMailbox.id);
          console.log(`[TempMail] Deleted temporary mailbox: ${tempMailbox.full_address}`);
        } catch (error) {
          console.error(`[TempMail] Failed to delete mailbox:`, error);
        }
      }
    }
  }
});
