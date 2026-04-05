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

    if (!passwordFilled) {
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

    if (outcome.kind === "email_code_requested") {
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
          filter: (email) => {
            // 根据 target.profile 配置过滤邮件
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
        // 使用传统 IMAP 方式
        code = await waitForEmailCode(flowStartedAt, targetProfile.emailVerification);
      }

      // 人类行为：缓慢输入验证码
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
