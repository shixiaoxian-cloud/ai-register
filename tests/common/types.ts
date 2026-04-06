/**
 * 通用测试类型定义
 */

import type { Page, TestInfo } from "@playwright/test";
import type { FlowStage, OutcomeKind, OutcomeRecord } from "../../src/types";

export type { FlowStage, OutcomeKind, OutcomeRecord };

/**
 * 测试上下文
 */
export interface TestContext {
  page: Page;
  testInfo: TestInfo;
  summary: OutcomeRecord[];
}

/**
 * 邮箱验证重试策略
 */
export interface EmailVerificationRetryPolicy {
  waitTimeoutMs: number;
  resendWaitTimeoutMs: number;
  resendAttempts: number;
}
