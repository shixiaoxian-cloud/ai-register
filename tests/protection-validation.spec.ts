import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { getConfiguredStartUrl } from "../src/config/target-site";
import { requireEnv, runtimeConfig, tempMailConfig } from "../src/env";
import { waitForEmailCode } from "../src/email/imap";
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
  bypassCloudflare,
  detectCloudflareBlock,
  waitForPageLoad
} from "../src/stealth/expert-bypass";
import {
  setupTopTierAntiDetection
} from "../src/stealth/top-tier-bypass";
import targetProfile from "../src/target.profile";
import type {
  EmailVerificationConfig,
  FlowStage,
  OutcomeKind,
  OutcomeRecord
} from "../src/types";
import type { Page } from "@playwright/test";
import { generateUserRegistrationInfo } from "../src/utils/user-info-generator";
import { generateEmailLocalPart } from "../src/utils/email-generator";
import { saveTokenToMultipleFormats } from "../src/utils/token-saver";
import type { TokenData } from "../src/utils/token-saver";

const registrationRetryAttempts = Number(
  process.env.REGISTRATION_RETRY_ATTEMPTS ?? "2"
);
const defaultEmailCodeWaitTimeoutMs = 30_000;
const defaultEmailCodeResendAttempts = 1;
const emailCodeLookbackWindowMs = 5_000;

test.describe.configure({ retries: registrationRetryAttempts });

async function attachSummary(
  records: OutcomeRecord[],
  testInfo: TestInfo
): Promise<void> {
  await testInfo.attach("journey-summary.json", {
    body: Buffer.from(JSON.stringify(records, null, 2), "utf8"),
    contentType: "application/json"
  });
}

function getStageLabel(stage: FlowStage): string {
  const labels: Record<FlowStage, string> = {
    before_login: "登录前",
    credentials_submitted: "账号密码提交后",
    email_submitted: "邮箱提交后",
    password_submitted: "密码提交后",
    email_verification_submitted: "邮箱验证码提交后",
    after_manual_challenge: "人工完成挑战后"
  };

  return labels[stage];
}

function recordOutcome(
  summary: OutcomeRecord[],
  stage: FlowStage,
  kind: OutcomeKind,
  details: string,
  page?: Page
): void {
  const record: OutcomeRecord = {
    stage,
    stageLabel: getStageLabel(stage),
    kind,
    details,
    observedAt: new Date().toISOString(),
    url: page?.url()
  };

  summary.push(record);
  console.log(
    `[STAGE] ${record.stageLabel} | ${record.kind} | ${record.url ?? ""} | ${record.details}`
  );
}

class RetryableRegistrationFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRegistrationFailure";
  }
}

const postRegistrationSkipSelector = [
  'button:has-text("Skip"):not([data-skip-to-content])',
  'button:has-text("跳过"):not([data-skip-to-content])',
  'button.btn-ghost:has-text("Skip")',
  'button.btn-ghost:has(div:has-text("Skip"))',
  // Only match Skip links that are NOT accessibility links
  'a:has-text("Skip"):not([data-skip-to-content]):not([href="#main"])',
  'a:has-text("跳过"):not([data-skip-to-content]):not([href="#main"])'
].join(", ");

async function detectRegistrationFailure(page: Page): Promise<string | null> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const title = await page.title().catch(() => "");
  const combined = `${title}\n${bodyText}`;

  const isErrorPage =
    /oops,\s*an error occurred/i.test(combined) ||
    /operation timed out/i.test(combined);

  if (!isErrorPage) {
    return null;
  }

  if (/operation timed out/i.test(combined)) {
    return "注册流程进入错误页：Operation timed out。视为本次注册失败，将使用新资源重试。";
  }

  return "注册流程进入通用错误页。视为本次注册失败，将使用新资源重试。";
}

async function throwIfRegistrationFailed(
  page: Page,
  stage: FlowStage,
  summary: OutcomeRecord[],
  testInfo: TestInfo
): Promise<void> {
  const failureDetails = await detectRegistrationFailure(page);
  if (!failureDetails) {
    return;
  }

  recordOutcome(summary, stage, "unknown", failureDetails, page);
  await page
    .screenshot({
      path: testInfo.outputPath(
        `registration-failure-${stage}-${Date.now()}.png`
      ),
      fullPage: true
    })
    .catch(() => undefined);

  throw new RetryableRegistrationFailure(failureDetails);
}

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

async function fillPasswordIfVisible(page: Page): Promise<boolean> {
  if (!targetProfile.selectors.password) {
    return false;
  }

  const passwordField = page.locator(targetProfile.selectors.password).first();
  const passwordVisible = await passwordField.isVisible().catch(() => false);

  if (!passwordVisible) {
    return false;
  }

  await passwordField.fill(requireEnv("TARGET_PASSWORD"));
  return true;
}

async function isPreAuthChallengePage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const combined = `${title}\n${bodyText}`;

  return /请稍候|checking your browser|verify you are human|security check|unusual activity/i.test(
    combined
  );
}

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function getEmailVerificationRetryPolicy(
  emailVerification: EmailVerificationConfig | undefined
): {
  waitTimeoutMs: number;
  resendWaitTimeoutMs: number;
  resendAttempts: number;
} {
  const waitTimeoutMs = resolvePositiveInteger(
    emailVerification?.waitTimeoutMs,
    defaultEmailCodeWaitTimeoutMs
  );
  const resendWaitTimeoutMs = resolvePositiveInteger(
    emailVerification?.resendWaitTimeoutMs,
    waitTimeoutMs
  );
  const resendAttempts = Math.max(
    0,
    resolvePositiveInteger(
      emailVerification?.resendAttempts,
      defaultEmailCodeResendAttempts
    )
  );

  return {
    waitTimeoutMs,
    resendWaitTimeoutMs,
    resendAttempts
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isEmailWaitTimeoutError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /No matching email code arrived within|Timeout waiting for email after/i.test(
    message
  );
}

function getAgeFromBirthday(birthday: string, now = new Date()): number {
  const [yearText, monthText, dayText] = birthday.split("-");
  const birthYear = Number.parseInt(yearText, 10);
  const birthMonth = Number.parseInt(monthText, 10);
  const birthDay = Number.parseInt(dayText, 10);

  if (
    !Number.isFinite(birthYear) ||
    !Number.isFinite(birthMonth) ||
    !Number.isFinite(birthDay)
  ) {
    throw new Error(`无效的生日格式，无法计算年龄: ${birthday}`);
  }

  let age = now.getFullYear() - birthYear;
  const monthOffset = now.getMonth() + 1 - birthMonth;
  const dayOffset = now.getDate() - birthDay;
  const hasHadBirthdayThisYear =
    monthOffset > 0 || (monthOffset === 0 && dayOffset >= 0);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}

async function clickEmailVerificationResend(page: Page): Promise<boolean> {
  if (!targetProfile.selectors.emailCodeResend) {
    return false;
  }

  const resendButton = page.locator(targetProfile.selectors.emailCodeResend).first();
  const isVisible = await resendButton.isVisible().catch(() => false);
  console.log(`[Flow] Resend email button visible: ${isVisible}`);

  if (!isVisible) {
    return false;
  }

  await resendButton.scrollIntoViewIfNeeded().catch(() => undefined);
  await humanDelay(500, 1000);
  await humanMouseMove(page);
  await resendButton.click();
  await humanDelay(800, 1500);
  console.log("[Flow] Resend email button clicked");
  return true;
}

async function waitForVerificationCodeOnce(params: {
  receivedAfter: Date;
  timeoutMs: number;
  tempMailService: TempMailService | null;
  tempMailbox: Mailbox | null;
  emailVerification: EmailVerificationConfig;
}): Promise<string> {
  const {
    receivedAfter,
    timeoutMs,
    tempMailService,
    tempMailbox,
    emailVerification
  } = params;

  if (runtimeConfig.useTempMail) {
    if (!tempMailService || !tempMailbox) {
      throw new Error("临时邮箱已启用，但当前运行没有可用的临时邮箱上下文。");
    }

    console.log("[TempMail] Waiting for verification email...");
    console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
    console.log(`[TempMail] Mailbox Address: ${tempMailbox.full_address}`);
    console.log(`[TempMail] Timeout: ${timeoutMs}ms`);
    console.log(`[TempMail] Poll Interval: ${runtimeConfig.emailPollIntervalMs}ms`);
    console.log(`[TempMail] Received After: ${receivedAfter.toISOString()}`);
    console.log(
      "[TempMail] Latest email mode enabled: sender/subject filters are skipped"
    );

    const result = await tempMailService.waitForEmail(tempMailbox.id, {
      timeout: timeoutMs,
      interval: runtimeConfig.emailPollIntervalMs,
      emailAddress: tempMailbox.full_address,
      useLatestApi: false,
      receivedAfter
    });

    console.log(`[TempMail] ✓ Received email from: ${result.from}`);
    console.log(`[TempMail] ✓ Subject: ${result.subject}`);
    console.log(
      `[TempMail] ✓ Text body preview: ${result.text_body?.substring(0, 100)}...`
    );

    const extractedCode = tempMailService.extractVerificationCode(
      result,
      emailVerification.codePattern
    );

    if (!extractedCode) {
      console.error("[TempMail] ✗ Failed to extract code from email");
      console.error(`[TempMail] Email subject: ${result.subject}`);
      console.error(
        `[TempMail] Email text: ${result.text_body?.substring(0, 200)}`
      );
      throw new Error(
        `Failed to extract verification code from email: ${result.subject}`
      );
    }

    console.log(`[TempMail] ✓ Extracted verification code: ${extractedCode}`);
    return extractedCode;
  }

  console.log("[TempMail] Using IMAP method (not temp mail)");
  return waitForEmailCode(receivedAfter, emailVerification, timeoutMs);
}

async function waitForVerificationCodeWithRetry(params: {
  page: Page;
  receivedAfter: Date;
  tempMailService: TempMailService | null;
  tempMailbox: Mailbox | null;
  emailVerification: EmailVerificationConfig;
}): Promise<string> {
  const {
    page,
    tempMailService,
    tempMailbox,
    emailVerification
  } = params;
  const retryPolicy = getEmailVerificationRetryPolicy(emailVerification);
  let attemptReceivedAfter = params.receivedAfter;

  for (let attempt = 0; attempt <= retryPolicy.resendAttempts; attempt++) {
    const timeoutMs =
      attempt === 0 ? retryPolicy.waitTimeoutMs : retryPolicy.resendWaitTimeoutMs;

    console.log(
      `[Flow] Waiting for email code attempt ${attempt + 1}/${retryPolicy.resendAttempts + 1} (timeout ${timeoutMs}ms)`
    );

    try {
      return await waitForVerificationCodeOnce({
        receivedAfter: attemptReceivedAfter,
        timeoutMs,
        tempMailService,
        tempMailbox,
        emailVerification
      });
    } catch (error) {
      if (!isEmailWaitTimeoutError(error)) {
        console.error("[TempMail] ✗ Error waiting for email:", error);
        throw error;
      }

      console.warn(
        `[Flow] Email code wait attempt ${attempt + 1} timed out after ${timeoutMs}ms`
      );

      if (attempt >= retryPolicy.resendAttempts) {
        throw new RetryableRegistrationFailure(
          `邮箱验证码在已配置的 ${retryPolicy.resendAttempts + 1} 次等待内仍未送达（首次 ${retryPolicy.waitTimeoutMs / 1000} 秒，重发后 ${retryPolicy.resendWaitTimeoutMs / 1000} 秒），视为本次注册失败，将使用新资源重试。`
        );
      }

      const resendClicked = await clickEmailVerificationResend(page);
      if (!resendClicked) {
        throw new RetryableRegistrationFailure(
          `邮箱验证码在 ${timeoutMs / 1000} 秒内未送达，且未找到可点击的 Resend email 按钮，视为本次注册失败，将使用新资源重试。`
        );
      }

      attemptReceivedAfter = new Date();
      console.log(
        `[Flow] Waiting for a fresh verification email after resend from ${attemptReceivedAfter.toISOString()}`
      );
    }
  }

  throw new RetryableRegistrationFailure(
    "邮箱验证码重试流程异常结束，视为本次注册失败，将使用新资源重试。"
  );
}

async function submitEmailVerificationCode(page: Page, code: string): Promise<void> {
  if (!targetProfile.selectors.emailCodeInput) {
    throw new Error("启用邮箱验证码流程时，必须配置 emailCodeInput 选择器。");
  }

  console.log(`[Flow] Filling verification code: ${code}`);
  await humanDelay(800, 1500);
  await humanType(page, targetProfile.selectors.emailCodeInput, code);
  console.log("[Flow] ✓ Verification code filled");

  if (targetProfile.selectors.emailCodeSubmit) {
    console.log("[Flow] Clicking verification code submit button");
    await humanDelay(500, 1000);
    await humanMouseMove(page);
    await page.locator(targetProfile.selectors.emailCodeSubmit).click();
    console.log("[Flow] ✓ Submit button clicked");
  }

  await targetProfile.afterEmailCodeFilled?.(page);
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

    // 使用专家级 Cloudflare 绕过方案
    const targetUrl = new URL(startUrl);
    const needsCloudflareBypass = targetUrl.host.includes('chatgpt.com') || targetUrl.host.includes('openai.com');

    if (needsCloudflareBypass) {
      console.log('[Expert] Using expert-level Cloudflare bypass...');
      const bypassSuccess = await bypassCloudflare(page, context, startUrl);

      if (!bypassSuccess) {
        recordOutcome(
          summary,
          "before_login",
          "blocked",
          "Cloudflare 高级验证失败，页面被拦截",
          page
        );

        await page.screenshot({
          path: testInfo.outputPath("cloudflare-blocked.png"),
          fullPage: true
        });

        throw new Error(
          "Cloudflare 验证失败。页面显示 'Incompatible browser extension or network configuration'。" +
          "建议：1) 使用真实浏览器 Profile；2) 检查网络设置；3) 尝试住宅代理。"
        );
      }

      console.log('[Expert] ✓ Cloudflare bypass successful');
    } else {
      // 非 ChatGPT 站点，直接访问
      await humanDelay(1000, 2000);
      await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForPageLoad(page);
    }

    // 检查是否仍然被拦截
    const isBlocked = await detectCloudflareBlock(page);
    if (isBlocked) {
      recordOutcome(
        summary,
        "before_login",
        "blocked",
        "目标页面仍然被 Cloudflare 拦截",
        page
      );

      await page.screenshot({
        path: testInfo.outputPath("target-page-blocked.png"),
        fullPage: true
      });

      throw new Error("目标页面被 Cloudflare 拦截，无法继续测试");
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

    // 检查是否需要填写账户资料（全名、年龄或生日）
    await humanDelay(2000, 3000);

    const fullNameVisible = targetProfile.selectors.fullName
      ? await activePage
          .locator(targetProfile.selectors.fullName)
          .first()
          .isVisible()
          .catch(() => false)
      : false;

    const ageFieldVisible = targetProfile.selectors.age
      ? await activePage
          .locator(targetProfile.selectors.age)
          .first()
          .isVisible()
          .catch(() => false)
      : false;

    const birthdayFieldVisible =
      Boolean(
        targetProfile.selectors.birthdayYear &&
          targetProfile.selectors.birthdayMonth &&
          targetProfile.selectors.birthdayDay
      ) &&
      await activePage
        .locator(
          [
            targetProfile.selectors.birthdayYear,
            targetProfile.selectors.birthdayMonth,
            targetProfile.selectors.birthdayDay
          ].join(", ")
        )
        .first()
        .isVisible()
        .catch(() => false);

    if (fullNameVisible || ageFieldVisible || birthdayFieldVisible) {
      console.log(
        `[Flow] Account details input detected (fullName=${fullNameVisible}, age=${ageFieldVisible}, birthday=${birthdayFieldVisible})`
      );

      if (fullNameVisible && targetProfile.selectors.fullName) {
        const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
        console.log(`[UserInfo] Filling full name: ${fullName}`);
        await humanDelay(500, 1000);
        await humanType(activePage, targetProfile.selectors.fullName, fullName);
      }

      if (ageFieldVisible && targetProfile.selectors.age) {
        console.log("[UserInfo] Filling age");
        const age = getAgeFromBirthday(userInfo.birthday);

        await humanDelay(300, 600);
        const ageField = activePage.locator(targetProfile.selectors.age).first();
        await ageField.fill(age.toString());
        await ageField.blur().catch(() => undefined);
        console.log(`[UserInfo] Age filled: ${age}`);
      } else if (
        birthdayFieldVisible &&
        targetProfile.selectors.birthdayYear &&
        targetProfile.selectors.birthdayMonth &&
        targetProfile.selectors.birthdayDay
      ) {
        console.log(`[UserInfo] Filling birthday: ${userInfo.birthday}`);
        const [year, month, day] = userInfo.birthday.split("-");

        await humanDelay(300, 600);
        const monthField = activePage
          .locator(targetProfile.selectors.birthdayMonth)
          .first();
        await monthField.click();
        await monthField.fill("");
        await humanType(activePage, targetProfile.selectors.birthdayMonth, month);

        await humanDelay(300, 600);
        const dayField = activePage.locator(targetProfile.selectors.birthdayDay).first();
        await dayField.click();
        await dayField.fill("");
        await humanType(activePage, targetProfile.selectors.birthdayDay, day);

        await humanDelay(300, 600);
        const yearField = activePage
          .locator(targetProfile.selectors.birthdayYear)
          .first();
        await yearField.click();
        await yearField.fill(year);
        await yearField.blur();
      }

      // 点击完成账户创建按钮
      await humanDelay(1000, 2000);
      await humanMouseMove(activePage);

      if (targetProfile.selectors.completeAccountButton) {
        await activePage.locator(targetProfile.selectors.completeAccountButton).click();
      } else {
        await activePage.locator(targetProfile.selectors.submit).click();
      }

      await throwIfRegistrationFailed(
        activePage,
        "after_manual_challenge",
        summary,
        testInfo
      );

      // 等待页面跳转到 ChatGPT 主页
      await humanDelay(3000, 5000);

      console.log(`[Flow] Current URL: ${activePage.url()}`);

      // 注册完成后可能出现偏好页/引导页，优先点击 Skip
      await dismissPostRegistrationOnboarding(activePage);

      // 等待最终结果 (在点击 Skip 之后检查)
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
      console.log('[Token] Registration completed, attempting to extract tokens...');

      try {
        // 等待页面稳定
        await humanDelay(2000, 3000);

        // 尝试从 cookies 中提取 session token
        const cookies = await activePage.context().cookies();
        console.log(`[Token] Found ${cookies.length} cookies`);

        let sessionToken = '';
        let csrfToken = '';
        for (const cookie of cookies) {
          if (cookie.name === '__Secure-next-auth.session-token' || cookie.name === 'next-auth.session-token') {
            console.log(`[Token] Found session token: ${cookie.name}`);
            sessionToken = cookie.value;
          }
          if (cookie.name.includes('csrf-token')) {
            csrfToken = cookie.value;
          }
        }

        console.log(`[Token] Session token found: ${!!sessionToken}`);
        console.log(`[Token] CSRF token found: ${!!csrfToken}`);

        // 先初始化 tokens 对象
        let tokens = {
          accessToken: '',
          refreshToken: '',
          idToken: ''
        };

        // 如果有 session token，尝试通过 API 获取 access token
        if (sessionToken) {
          try {
            console.log('[Token] Attempting to fetch access token via API...');
            const response = await activePage.evaluate(async () => {
              try {
                const res = await fetch('https://chatgpt.com/api/auth/session', {
                  method: 'GET',
                  credentials: 'include'
                });
                if (res.ok) {
                  return await res.json();
                }
                return null;
              } catch (e) {
                return null;
              }
            });

            if (response && response.accessToken) {
              console.log('[Token] ✓ Successfully fetched access token from API');
              tokens.accessToken = response.accessToken;
              tokens.refreshToken = response.refreshToken || '';
              tokens.idToken = response.idToken || '';
            } else {
              console.log('[Token] API returned no access token, will try page extraction');
            }
          } catch (error) {
            console.log('[Token] Failed to fetch access token from API:', error);
          }
        } else {
          console.log('[Token] No session token found, trying alternative methods...');

          // 尝试导航到主页来获取 session token
          try {
            console.log('[Token] Navigating to ChatGPT home to get session...');
            await activePage.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
            await humanDelay(2000, 3000);

            const newCookies = await activePage.context().cookies();
            for (const cookie of newCookies) {
              if (cookie.name === '__Secure-next-auth.session-token' || cookie.name === 'next-auth.session-token') {
                console.log(`[Token] Found session token after navigation: ${cookie.name}`);
                sessionToken = cookie.value;
                break;
              }
            }

            if (sessionToken) {
              const response = await activePage.evaluate(async () => {
                try {
                  const res = await fetch('https://chatgpt.com/api/auth/session', {
                    method: 'GET',
                    credentials: 'include'
                  });
                  if (res.ok) {
                    return await res.json();
                  }
                  return null;
                } catch (e) {
                  return null;
                }
              });

              if (response && response.accessToken) {
                console.log('[Token] ✓ Successfully fetched access token after navigation');
                tokens.accessToken = response.accessToken;
                tokens.refreshToken = response.refreshToken || '';
                tokens.idToken = response.idToken || '';
              }
            }
          } catch (error) {
            console.log('[Token] Failed to navigate to home page:', error);
          }
        }

        // 如果还没有 token，尝试从页面中提取
        if (!tokens.accessToken) {
          const pageTokens = await activePage.evaluate(() => {
            // 方法 1: 从 localStorage 获取
            let accessToken = localStorage.getItem('accessToken') ||
                             localStorage.getItem('access_token') || '';
            let refreshToken = localStorage.getItem('refreshToken') ||
                              localStorage.getItem('refresh_token') || '';
            let idToken = localStorage.getItem('idToken') ||
                         localStorage.getItem('id_token') || '';

            // 方法 2: 从 cookies 获取
            if (!accessToken) {
              const cookies = document.cookie.split(';');
              for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === '__Secure-next-auth.session-token' || name === 'next-auth.session-token') {
                  accessToken = decodeURIComponent(value);
                }
              }
            }

            // 方法 3: 从 __NEXT_DATA__ 获取
            if (!accessToken) {
              try {
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                  const data = JSON.parse(nextData.textContent || '{}');
                  const props = data?.props?.pageProps;
                  if (props?.accessToken) accessToken = props.accessToken;
                  if (props?.refreshToken) refreshToken = props.refreshToken;
                  if (props?.idToken) idToken = props.idToken;
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }

            return {
              accessToken: accessToken,
              refreshToken: refreshToken,
              idToken: idToken
            };
          });

          // 合并 pageTokens 到 tokens
          if (pageTokens.accessToken) {
            tokens = pageTokens;
          }
        }

        if (tokens.accessToken) {
          console.log('[Token] ✓ Access token found');

          const tokenData: TokenData = {
            email: tempMailbox?.full_address || requireEnv("TARGET_EMAIL"),
            password: userInfo.password,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            idToken: tokens.idToken
          };

          // 保存到本地文件（CPA 和 Sub2Api 格式）
          const outputDir = process.env.TOKEN_OUTPUT_DIR || './output_tokens';
          const requestedRunCount = Number(process.env.PLATFORM_RUN_COUNT || '1');
          const executionLabel =
            requestedRunCount > 1 ? `run-${testInfo.repeatEachIndex + 1}` : undefined;
          const savedPaths = await saveTokenToMultipleFormats(tokenData, outputDir, {
            fileLabel: executionLabel
          });

          if (savedPaths.cpa) {
            console.log(`[Token] ✓ CPA format saved: ${savedPaths.cpa}`);
          }
          if (savedPaths.sub2api) {
            console.log(`[Token] ✓ Sub2Api format saved: ${savedPaths.sub2api}`);
          }

          // 附加 token 信息到测试报告
          await testInfo.attach("tokens.json", {
            body: Buffer.from(JSON.stringify({
              email: tokenData.email,
              hasAccessToken: !!tokenData.accessToken,
              hasRefreshToken: !!tokenData.refreshToken,
              hasIdToken: !!tokenData.idToken,
              savedPaths: savedPaths
            }, null, 2), "utf8"),
            contentType: "application/json"
          });
        } else if (sessionToken) {
          console.log('[Token] ✓ Session token found in cookies');
          console.log(`[Token] Session token: ${sessionToken.substring(0, 20)}...`);

          // 保存 session token 信息
          await testInfo.attach("session-info.json", {
            body: Buffer.from(JSON.stringify({
              email: tempMailbox?.full_address || requireEnv("TARGET_EMAIL"),
              password: userInfo.password,
              sessionToken: sessionToken,
              note: "Session token found in cookies - may need to exchange for access token"
            }, null, 2), "utf8"),
            contentType: "application/json"
          });
        } else {
          console.log('[Token] ⚠ No access token found in page storage');
          console.log('[Token] ℹ This may be normal - ChatGPT uses session-based auth');
        }
      } catch (error) {
        console.error('[Token] Failed to extract or save tokens:', error);
      }
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
