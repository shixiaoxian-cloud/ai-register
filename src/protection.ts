import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { Page } from "@playwright/test";

import type { OutcomeKind, TargetSelectors } from "./types";

interface DetectedOutcome {
  kind: OutcomeKind;
  details: string;
}

async function isVisible(page: Page, selector: string | undefined): Promise<boolean> {
  if (!selector) {
    return false;
  }

  const locator = page.locator(selector).first();
  const count = await locator.count();
  if (!count) {
    return false;
  }

  return locator.isVisible().catch(() => false);
}

async function detectOutcome(
  page: Page,
  selectors: TargetSelectors
): Promise<DetectedOutcome | null> {
  const checks: Array<[OutcomeKind, string | undefined, string]> = [
    ["blocked", selectors.blocked, "页面出现了阻断页或风险提示。"],
    ["success", selectors.success, "页面出现了注册成功后的目标标记。"],
    [
      "email_code_requested",
      selectors.emailCodeInput,
      "页面出现了邮箱验证码输入框。"
    ],
    ["captcha", selectors.captcha, "页面出现了 CAPTCHA 或等效的人机验证。"],
    [
      "sms_challenge",
      selectors.smsChallenge,
      "页面出现了短信验证码挑战。"
    ],
    [
      "device_challenge",
      selectors.deviceChallenge,
      "页面出现了设备或安全校验挑战。"
    ]
  ];

  for (const [kind, selector, details] of checks) {
    if (await isVisible(page, selector)) {
      return { kind, details };
    }
  }

  return null;
}

export async function waitForKnownOutcome(
  page: Page,
  selectors: TargetSelectors,
  timeoutMs: number
): Promise<DetectedOutcome> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const outcome = await detectOutcome(page, selectors);
    if (outcome) {
      return outcome;
    }

    await page.waitForTimeout(1_000);
  }

  return {
    kind: "unknown",
    details: `在 ${timeoutMs}ms 内没有出现已配置的成功标记、阻断页、验证码输入框或安全挑战。`
  };
}

export async function waitForManualClearance(
  promptMessage: string,
  timeoutMs: number
): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    output.write(`\n[需要人工处理]\n${promptMessage}\n`);
    await Promise.race([
      rl.question("请在浏览器中完成验证，然后按回车继续。"),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `人工处理等待已超时，超过 ${timeoutMs}ms。`
              )
            ),
          timeoutMs
        )
      )
    ]);
  } finally {
    rl.close();
  }
}
