/**
 * 错误处理工具
 */

import type { Page, TestInfo } from "@playwright/test";
import type { FlowStage, OutcomeRecord } from "./types";
import { recordOutcome } from "./outcome-recorder";

/**
 * 可重试的注册失败错误
 */
export class RetryableRegistrationFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRegistrationFailure";
  }
}

/**
 * 检测注册流程是否失败
 */
export async function detectRegistrationFailure(page: Page): Promise<string | null> {
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

/**
 * 如果注册失败则抛出异常
 */
export async function throwIfRegistrationFailed(
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

/**
 * 获取错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * 判断是否为邮箱等待超时错误
 */
export function isEmailWaitTimeoutError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /No matching email code arrived within|Timeout waiting for email after/i.test(
    message
  );
}
