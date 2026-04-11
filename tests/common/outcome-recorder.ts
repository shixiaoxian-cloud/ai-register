/**
 * 测试结果记录工具
 */

import type { Page, TestInfo } from "@playwright/test";
import { browserEnvironmentContext } from "../../src/env";
import type { FlowStage, OutcomeKind, OutcomeRecord } from "./types";

/**
 * 获取流程阶段的中文标签
 */
export function getStageLabel(stage: FlowStage): string {
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

/**
 * 记录测试结果
 */
export function recordOutcome(
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

/**
 * 附加测试摘要到测试报告
 */
export async function attachSummary(
  records: OutcomeRecord[],
  testInfo: TestInfo
): Promise<void> {
  await testInfo.attach("journey-summary.json", {
    body: Buffer.from(JSON.stringify(records, null, 2), "utf8"),
    contentType: "application/json"
  });

  await testInfo.attach("browser-environment-summary.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          summary: browserEnvironmentContext.summary,
          error: browserEnvironmentContext.error,
          config: browserEnvironmentContext.config
        },
        null,
        2
      ),
      "utf8"
    ),
    contentType: "application/json"
  });

  await testInfo.attach("acceptance-summary.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          finalOutcome: records.at(-1)?.kind || "unknown",
          finalStage: records.at(-1)?.stage || "unknown",
          browserEnvironment: {
            summary: browserEnvironmentContext.summary,
            error: browserEnvironmentContext.error,
            configId: browserEnvironmentContext.config?.id || null,
            configName: browserEnvironmentContext.config?.name || null,
            approvalStatus:
              browserEnvironmentContext.config?.approvalStatus || null
          },
          records
        },
        null,
        2
      ),
      "utf8"
    ),
    contentType: "application/json"
  });
}
