/**
 * 账户资料填写模块
 * 负责填写全名、年龄、生日等账户信息
 */

import type { Page } from "@playwright/test";
import {
  humanDelay,
  humanMouseMove,
  humanType
} from "../../../src/stealth/advanced-stealth";
import targetProfile from "../../../src/target.profile";
import { getAgeFromBirthday } from "../../common/page-helpers";

export interface UserInfo {
  firstName: string;
  lastName: string;
  birthday: string;
  password: string;
}

/**
 * 检查是否需要填写账户资料
 */
export async function needsAccountDetails(page: Page): Promise<{
  fullName: boolean;
  age: boolean;
  birthday: boolean;
}> {
  const fullNameVisible = targetProfile.selectors.fullName
    ? await page
        .locator(targetProfile.selectors.fullName)
        .first()
        .isVisible()
        .catch(() => false)
    : false;

  const ageFieldVisible = targetProfile.selectors.age
    ? await page
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
    await page
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

  return {
    fullName: fullNameVisible,
    age: ageFieldVisible,
    birthday: birthdayFieldVisible
  };
}

/**
 * 填写全名
 */
export async function fillFullName(page: Page, userInfo: UserInfo): Promise<void> {
  if (!targetProfile.selectors.fullName) {
    return;
  }

  const fullName = `${userInfo.firstName} ${userInfo.lastName}`;
  console.log(`[UserInfo] Filling full name: ${fullName}`);
  await humanDelay(500, 1000);
  await humanType(page, targetProfile.selectors.fullName, fullName);
}

/**
 * 填写年龄
 */
export async function fillAge(page: Page, userInfo: UserInfo): Promise<void> {
  if (!targetProfile.selectors.age) {
    return;
  }

  console.log("[UserInfo] Filling age");
  const age = getAgeFromBirthday(userInfo.birthday);

  await humanDelay(300, 600);
  const ageField = page.locator(targetProfile.selectors.age).first();
  await ageField.fill(age.toString());
  await ageField.blur().catch(() => undefined);
  console.log(`[UserInfo] Age filled: ${age}`);
}

/**
 * 填写生日
 */
export async function fillBirthday(page: Page, userInfo: UserInfo): Promise<void> {
  if (
    !targetProfile.selectors.birthdayYear ||
    !targetProfile.selectors.birthdayMonth ||
    !targetProfile.selectors.birthdayDay
  ) {
    return;
  }

  console.log(`[UserInfo] Filling birthday: ${userInfo.birthday}`);
  const [year, month, day] = userInfo.birthday.split("-");

  await humanDelay(300, 600);
  const monthField = page
    .locator(targetProfile.selectors.birthdayMonth)
    .first();
  await monthField.click();
  await monthField.fill("");
  await humanType(page, targetProfile.selectors.birthdayMonth, month);

  await humanDelay(300, 600);
  const dayField = page.locator(targetProfile.selectors.birthdayDay).first();
  await dayField.click();
  await dayField.fill("");
  await humanType(page, targetProfile.selectors.birthdayDay, day);

  await humanDelay(300, 600);
  const yearField = page
    .locator(targetProfile.selectors.birthdayYear)
    .first();
  await yearField.click();
  await yearField.fill(year);
  await yearField.blur();
}

/**
 * 填写账户资料（全流程）
 */
export async function fillAccountDetails(page: Page, userInfo: UserInfo): Promise<void> {
  const needs = await needsAccountDetails(page);

  console.log(
    `[Flow] Account details input detected (fullName=${needs.fullName}, age=${needs.age}, birthday=${needs.birthday})`
  );

  if (needs.fullName) {
    await fillFullName(page, userInfo);
  }

  if (needs.age) {
    await fillAge(page, userInfo);
  } else if (needs.birthday) {
    await fillBirthday(page, userInfo);
  }

  // 点击完成账户创建按钮
  await humanDelay(1000, 2000);
  await humanMouseMove(page);

  if (targetProfile.selectors.completeAccountButton) {
    await page.locator(targetProfile.selectors.completeAccountButton).click();
  } else {
    await page.locator(targetProfile.selectors.submit).click();
  }

  console.log("[Flow] ✓ Account details submitted");
}
