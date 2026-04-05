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

      // 填写生日
      if (targetProfile.selectors.birthdayYear &&
          targetProfile.selectors.birthdayMonth &&
          targetProfile.selectors.birthdayDay) {

        console.log(`[UserInfo] Filling birthday: ${userInfo.birthday}`);
        const [year, month, day] = userInfo.birthday.split('-');

        // 填写年份
        await humanDelay(500, 800);
        const yearField = activePage.locator(targetProfile.selectors.birthdayYear).first();
        await yearField.click();
        await yearField.fill('');
        await humanType(activePage, targetProfile.selectors.birthdayYear, year);

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
      }

      // 点击完成账户创建按钮
      await humanDelay(1000, 2000);
      await humanMouseMove(activePage);

      if (targetProfile.selectors.completeAccountButton) {
        await activePage.locator(targetProfile.selectors.completeAccountButton).click();
      } else {
        await activePage.locator(targetProfile.selectors.submit).click();
      }

      // 等待最终结果
      await humanDelay(3000, 5000);
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

    // 如果注册成功，尝试提取并保存 token
    if (finalOutcomeKind === "success") {
      console.log('[Token] Registration successful, attempting to extract tokens...');

      try {
        // 等待页面稳定
        await humanDelay(2000, 3000);

        // 尝试从页面中提取 token（通过 localStorage 或 cookies）
        const tokens = await activePage.evaluate(() => {
          // 尝试从 localStorage 获取
          const accessToken = localStorage.getItem('accessToken') ||
                             localStorage.getItem('access_token') || '';
          const refreshToken = localStorage.getItem('refreshToken') ||
                              localStorage.getItem('refresh_token') || '';
          const idToken = localStorage.getItem('idToken') ||
                         localStorage.getItem('id_token') || '';

          return {
            accessToken: accessToken,
            refreshToken: refreshToken,
            idToken: idToken
          };
        });

        if (tokens.accessToken) {
          console.log('[Token] ✓ Access token found');

          const tokenData: TokenData = {
            email: requireEnv("TARGET_EMAIL"),
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
        } else {
          console.log('[Token] ⚠ No access token found in page storage');
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
