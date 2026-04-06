/**
 * 邮箱验证模块
 * 负责邮箱验证码的获取、重试和提交
 */

import type { Page } from "@playwright/test";
import { waitForEmailCode } from "../../../src/email/imap";
import type {
  TempMailService,
  Mailbox
} from "../../../src/email/temp-mail";
import type { EmailVerificationConfig } from "../../../src/types";
import {
  humanDelay,
  humanMouseMove,
  humanType
} from "../../../src/stealth/advanced-stealth";
import targetProfile from "../../../src/target.profile";
import { resolvePositiveInteger } from "../../common/page-helpers";
import { RetryableRegistrationFailure, isEmailWaitTimeoutError } from "../../common/error-handling";
import type { EmailVerificationRetryPolicy } from "../../common/types";

const defaultEmailCodeWaitTimeoutMs = 30_000;
const defaultEmailCodeResendAttempts = 1;

/**
 * 获取邮箱验证重试策略
 */
export function getEmailVerificationRetryPolicy(
  emailVerification: EmailVerificationConfig | undefined
): EmailVerificationRetryPolicy {
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

/**
 * 点击邮箱验证码重发按钮
 */
export async function clickEmailVerificationResend(page: Page): Promise<boolean> {
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
  console.log("[Flow] ✓ Resend email button clicked");

  return true;
}

/**
 * 等待验证码（单次尝试）
 */
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

  if (tempMailService && tempMailbox) {
    console.log("[TempMail] Using temp mail method");
    const extractedCode = await tempMailService.waitForVerificationCode(
      tempMailbox.id,
      receivedAfter,
      emailVerification.codePattern,
      timeoutMs
    );

    console.log(`[TempMail] ✓ Extracted verification code: ${extractedCode}`);
    return extractedCode;
  }

  console.log("[TempMail] Using IMAP method (not temp mail)");
  return waitForEmailCode(receivedAfter, emailVerification, timeoutMs);
}

/**
 * 等待验证码（带重试）
 */
export async function waitForVerificationCodeWithRetry(params: {
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

/**
 * 提交邮箱验证码
 */
export async function submitEmailVerificationCode(page: Page, code: string): Promise<void> {
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
