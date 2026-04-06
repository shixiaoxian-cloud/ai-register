/**
 * 页面操作辅助函数
 */

import type { Page } from "@playwright/test";
import { requireEnv } from "../../src/env";
import targetProfile from "../../src/target.profile";

/**
 * 如果密码框可见则填写密码
 */
export async function fillPasswordIfVisible(page: Page): Promise<boolean> {
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

/**
 * 检查是否为登录前的挑战页面
 */
export async function isPreAuthChallengePage(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const combined = `${title}\n${bodyText}`;

  return /请稍候|checking your browser|verify you are human|security check|unusual activity/i.test(
    combined
  );
}

/**
 * 解析正整数，如果无效则返回默认值
 */
export function resolvePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

/**
 * 从生日计算年龄
 */
export function getAgeFromBirthday(birthday: string, now = new Date()): number {
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
