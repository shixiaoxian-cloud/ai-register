import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { getConfiguredStartUrl } from "../src/config/target-site";
import { requireEnv, runtimeConfig, tempMailConfig } from "../src/env";
import { waitForEmailCode } from "../src/email/imap";
import { createTempMailService } from "../src/email/temp-mail";
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
import type { FlowStage, OutcomeKind, OutcomeRecord } from "../src/types";
import type { Page } from "@playwright/test";
import { generateUserRegistrationInfo } from "../src/utils/user-info-generator";
import { generateEmailLocalPart } from "../src/utils/email-generator";
import { saveTokenToMultipleFormats } from "../src/utils/token-saver";
import type { TokenData } from "../src/utils/token-saver";

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

test("验证已授权目标站点的保护流程", async ({ page, context }, testInfo) => {
  const summary: OutcomeRecord[] = [];
  const flowStartedAt = new Date();
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
  let tempMailbox: { id: string; full_address: string } | null = null;

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

      // 直接跳转到验证码处理流程
      if (!targetProfile.emailVerification?.enabled) {
        throw new Error(
          "页面要求输入邮箱验证码，但 target.profile 中未启用 emailVerification。"
        );
      }

      let code: string;

      // 根据配置选择邮件获取方式
      if (runtimeConfig.useTempMail && tempMailService && tempMailbox) {
        console.log(`[TempMail] Waiting for verification email...`);
        console.log(`[TempMail] Mailbox ID: ${tempMailbox.id}`);
        console.log(`[TempMail] Mailbox Address: ${tempMailbox.full_address}`);
        console.log(`[TempMail] Timeout: ${runtimeConfig.emailTimeoutMs}ms`);
        console.log(`[TempMail] Poll Interval: ${runtimeConfig.emailPollIntervalMs}ms`);

        try {
          const result = await tempMailService.waitForEmail(tempMailbox.id, {
            timeout: runtimeConfig.emailTimeoutMs,
            interval: runtimeConfig.emailPollIntervalMs,
            emailAddress: tempMailbox.full_address,
            useLatestApi: true,
            filter: (email) => {
              console.log(`[TempMail] Checking email from: ${email.from}, subject: ${email.subject}`);
              if (targetProfile.emailVerification?.senderFilter) {
                const matches = email.from.includes(targetProfile.emailVerification.senderFilter);
                console.log(`[TempMail] Sender filter "${targetProfile.emailVerification.senderFilter}": ${matches}`);
                return matches;
              }
              if (targetProfile.emailVerification?.subjectFilter) {
                const matches = email.subject.includes(targetProfile.emailVerification.subjectFilter);
                console.log(`[TempMail] Subject filter "${targetProfile.emailVerification.subjectFilter}": ${matches}`);
                return matches;
              }
              console.log(`[TempMail] No filter, accepting email`);
              return true;
            }
          });

          console.log(`[TempMail] ✓ Received email from: ${result.from}`);
          console.log(`[TempMail] ✓ Subject: ${result.subject}`);
          console.log(`[TempMail] ✓ Text body preview: ${result.text_body?.substring(0, 100)}...`);

          const extractedCode = tempMailService.extractVerificationCode(
            result,
            targetProfile.emailVerification?.codePattern
          );

          if (!extractedCode) {
            console.error(`[TempMail] ✗ Failed to extract code from email`);
            console.error(`[TempMail] Email subject: ${result.subject}`);
            console.error(`[TempMail] Email text: ${result.text_body?.substring(0, 200)}`);
            throw new Error(
              `Failed to extract verification code from email: ${result.subject}`
            );
          }

          code = extractedCode;
          console.log(`[TempMail] ✓ Extracted verification code: ${code}`);
        } catch (error) {
          console.error(`[TempMail] ✗ Error waiting for email:`, error);
          throw error;
        }
      } else {
        console.log(`[TempMail] Using IMAP method (not temp mail)`);
        code = await waitForEmailCode(flowStartedAt, targetProfile.emailVerification);
      }

      // 输入验证码
      console.log(`[Flow] Filling verification code: ${code}`);
      await humanDelay(800, 1500);
      await humanType(activePage, targetProfile.selectors.emailCodeInput!, code);
      console.log(`[Flow] ✓ Verification code filled`);

      if (targetProfile.selectors.emailCodeSubmit) {
        console.log(`[Flow] Clicking verification code submit button`);
        await humanDelay(500, 1000);
        await humanMouseMove(activePage);
        await activePage.locator(targetProfile.selectors.emailCodeSubmit).click();
        console.log(`[Flow] ✓ Submit button clicked`);
      }

      await targetProfile.afterEmailCodeFilled?.(activePage);

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
        outcomeStage = "password_submitted";
      }
    }

    let outcome = await waitForKnownOutcome(
      activePage,
      targetProfile.selectors,
      30_000
    );
    recordOutcome(summary, outcomeStage, outcome.kind, outcome.details, activePage);
    finalOutcomeKind = outcome.kind;

    // 如果仍然需要验证码（通过 waitForKnownOutcome 检测到）
    if (outcome.kind === "email_code_requested") {
      console.log('[Flow] Email verification code requested (detected by waitForKnownOutcome)');

      if (!targetProfile.emailVerification?.enabled) {
        throw new Error(
          "页面要求输入邮箱验证码，但 target.profile 中未启用 emailVerification。"
        );
      }

      if (!targetProfile.selectors.emailCodeInput) {
        throw new Error("启用邮箱验证码流程时，必须配置 emailCodeInput 选择器。");
      }

      let code: string;

      // 根据配置选择邮件获取方式
      if (runtimeConfig.useTempMail && tempMailService && tempMailbox) {
        console.log(`[TempMail] Waiting for verification email...`);

        const result = await tempMailService.waitForEmail(tempMailbox.id, {
          timeout: runtimeConfig.emailTimeoutMs,
          interval: runtimeConfig.emailPollIntervalMs,
          emailAddress: tempMailbox.full_address,
          useLatestApi: true,
          filter: (email) => {
            if (targetProfile.emailVerification?.senderFilter) {
              return email.from.includes(targetProfile.emailVerification.senderFilter);
            }
            if (targetProfile.emailVerification?.subjectFilter) {
              return email.subject.includes(targetProfile.emailVerification.subjectFilter);
            }
            return true;
          }
        });

        console.log(`[TempMail] Received email from: ${result.from}`);
        console.log(`[TempMail] Subject: ${result.subject}`);

        const extractedCode = tempMailService.extractVerificationCode(
          result,
          targetProfile.emailVerification?.codePattern
        );

        if (!extractedCode) {
          throw new Error(
            `Failed to extract verification code from email: ${result.subject}`
          );
        }

        code = extractedCode;
        console.log(`[TempMail] Extracted verification code: ${code}`);
      } else {
        code = await waitForEmailCode(flowStartedAt, targetProfile.emailVerification);
      }

      // 输入验证码
      await humanDelay(800, 1500);
      await humanType(activePage, targetProfile.selectors.emailCodeInput, code);

      if (targetProfile.selectors.emailCodeSubmit) {
        await humanDelay(500, 1000);
        await humanMouseMove(activePage);
        await activePage.locator(targetProfile.selectors.emailCodeSubmit).click();
      }

      await targetProfile.afterEmailCodeFilled?.(activePage);
      outcome = await waitForKnownOutcome(activePage, targetProfile.selectors, 30_000);
      recordOutcome(
        summary,
        "email_verification_submitted",
        outcome.kind,
        outcome.details,
        activePage
      );
      finalOutcomeKind = outcome.kind;
    }

    // 检查是否需要填写全名和生日
    await humanDelay(2000, 3000);

    const fullNameVisible = targetProfile.selectors.fullName
      ? await activePage
          .locator(targetProfile.selectors.fullName)
          .first()
          .isVisible()
          .catch(() => false)
      : false;

    if (fullNameVisible) {
      console.log('[Flow] Full name and birthday input detected');

      // 填写全名
      const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
      console.log(`[UserInfo] Filling full name: ${fullName}`);
      await humanDelay(500, 1000);
      await humanType(activePage, targetProfile.selectors.fullName!, fullName);

      // 填写生日或年龄
      // 先检查是否有 "Age" 字段（新版UI）
      const ageFieldVisible = await activePage
        .locator('input[placeholder="Age"], input[aria-label="Age"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (ageFieldVisible) {
        // 新版UI：只需要填写年龄
        console.log(`[UserInfo] Filling age (new UI)`);
        const birthYear = parseInt(userInfo.birthday.split('-')[0]);
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthYear;

        await humanDelay(300, 600);
        const ageField = activePage.locator('input[placeholder="Age"], input[aria-label="Age"]').first();
        // 直接填写，不需要先点击（避免被 label 遮挡）
        await ageField.fill(age.toString());
        console.log(`[UserInfo] Age filled: ${age}`);
      } else if (targetProfile.selectors.birthdayYear &&
          targetProfile.selectors.birthdayMonth &&
          targetProfile.selectors.birthdayDay) {
        // 旧版UI：需要填写年月日
        console.log(`[UserInfo] Filling birthday: ${userInfo.birthday} (old UI)`);
        const [year, month, day] = userInfo.birthday.split('-');

        // 填写月份
        await humanDelay(300, 600);
        const monthField = activePage.locator(targetProfile.selectors.birthdayMonth).first();
        await monthField.click();
        await monthField.fill('');
        await humanType(activePage, targetProfile.selectors.birthdayMonth, month);

        // 填写日期
        await humanDelay(300, 600);
        const dayField = activePage.locator(targetProfile.selectors.birthdayDay).first();
        await dayField.click();
        await dayField.fill('');
        await humanType(activePage, targetProfile.selectors.birthdayDay, day);

        // 填写年份 (最后填写，避免 spinbutton 截断问题)
        await humanDelay(300, 600);
        const yearField = activePage.locator(targetProfile.selectors.birthdayYear).first();
        await yearField.click();
        // 对于 spinbutton，使用 fill 而不是 humanType
        await yearField.fill(year);
        // 触发 blur 事件确保值被接受
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

      // 等待页面跳转到 ChatGPT 主页
      await humanDelay(3000, 5000);

      console.log(`[Flow] Current URL: ${activePage.url()}`);

      // 检查是否出现 "What brings you to ChatGPT?" 页面，如果有则点击 Skip
      const skipButtonVisible = await activePage
        .locator('button:has-text("Skip"), button:has-text("跳过"), button.btn-ghost:has-text("Skip")')
        .first()
        .isVisible()
        .catch(() => false);

      console.log(`[Flow] Skip button visible: ${skipButtonVisible}`);

      if (skipButtonVisible) {
        console.log('[Flow] Onboarding page detected, clicking Skip button');
        await humanDelay(500, 1000);
        await humanMouseMove(activePage);
        await activePage.locator('button:has-text("Skip"), button:has-text("跳过"), button.btn-ghost:has-text("Skip")').first().click();
        await humanDelay(2000, 3000);
        console.log('[Flow] Skip button clicked, waiting for main page');
      }

      // 等待最终结果 (在点击 Skip 之后检查)
      console.log(`[Flow] Checking for success indicators on page: ${activePage.url()}`);
      outcome = await waitForKnownOutcome(activePage, targetProfile.selectors, 30_000);
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

      outcome = await waitForKnownOutcome(activePage, targetProfile.selectors, 30_000);
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

    // 如果注册成功或到达 ChatGPT 主页，尝试提取并保存 token
    const shouldExtractTokens = finalOutcomeKind === "success" ||
                                (finalOutcomeKind === "unknown" && activePage.url().includes("chatgpt.com"));

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
            }
          } catch (error) {
            console.log('[Token] Failed to fetch access token from API:', error);
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
          const savedPaths = await saveTokenToMultipleFormats(tokenData, outputDir);

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
