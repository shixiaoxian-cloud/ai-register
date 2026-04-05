import {
  DEFAULT_EXPECTED_OUTCOMES,
  readActivePlatformContext
} from "./config/platform-sqlite";
import type {
  EmailVerificationConfig,
  TargetProfile,
  TargetSelectors
} from "./types";

const defaultEmailSelector = [
  'input#email',
  'input[aria-label="电子邮件地址"]',
  'input[placeholder="电子邮件地址"]',
  'input[name="email"]',
  'input[type="email"]',
  'input[autocomplete*="email"]'
].join(", ");

const defaultLoginSelector = [
  'button[data-testid="login-button"]',
  '[data-testid="login-button"]',
  'button:has-text("登录")',
  'a:has-text("登录")',
  'button:has-text("Log in")',
  'a:has-text("Log in")',
  'button:has-text("Sign in")',
  'a:has-text("Sign in")'
].join(", ");

const defaultLoginDialogSelector = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-headlessui-state]',
  '[data-radix-popper-content-wrapper]'
].join(", ");

const defaultSelectors: TargetSelectors = {
  loginDialog: defaultLoginDialogSelector,
  email: defaultEmailSelector,
  password: [
    'input[type="password"]',
    'input[name="password"]',
    'input[aria-label="密码"]',
    'input[placeholder="密码"]',
    'div._typeableLabelText_18qcl_88:has-text("密码") + input',
    'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("密码")) input'
  ].join(", "),
  submit: 'button[type="submit"]',
  emailCodeInput: [
    'input[name="verificationCode"]',
    'input[name="code"]',
    'input[aria-label="Code"]',
    'input[placeholder="Code"]',
    'div._typeableLabelText_18qcl_88:has-text("Code") + input',
    'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("Code")) input'
  ].join(", "),
  emailCodeSubmit: [
    'button[type="submit"][name="intent"][value="validate"]',
    'button[data-dd-action-name="Continue"][type="submit"]:not([value="resend"])',
    'button._root_3rdp0_62._primary_3rdp0_107[type="submit"]:has-text("Continue")',
    'button[type="submit"]:has-text("继续")',
    'button[type="submit"]:has-text("Continue"):not(:has-text("Resend"))'
  ].join(", "),
  emailCodeResend: [
    'button[type="submit"][name="intent"][value="resend"]',
    'button._transparentButton_1jv2f_12[type="submit"][value="resend"]',
    'button[type="submit"]:has-text("Resend email")',
    'button[type="submit"]:has-text("重新发送")'
  ].join(", "),
  captcha: 'iframe[title*="captcha"], .g-recaptcha, [data-testid="captcha"]',
  smsChallenge: 'input[name="smsCode"], [data-testid="sms-challenge"]',
  deviceChallenge: 'text=/verify.*device|security check|unusual activity|suspicious login/i',
  success: [
    'text=/Ready when you are/i',
    'text=/What brings you to ChatGPT/i',
    'text=/New chat/i',
    'text=/welcome|dashboard|account created|registration complete/i',
    'text=/create.*workspace|workspace.*name|name.*workspace/i',
    '[data-testid="workspace-name-input"]',
    'input[placeholder*="workspace" i]'
  ].join(", "),
  blocked: 'text=/access denied|temporarily blocked|suspicious activity detected|try again later/i',
  fullName: [
    'input[name="name"]',
    'input[aria-label="全名"]',
    'input[placeholder="全名"]',
    'div._typeableLabelText_18qcl_88:has-text("全名") + input',
    'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("全名")) input'
  ].join(", "),
  age: [
    'input[name="age"]',
    'input[placeholder="Age"]',
    'input[aria-label="Age"]',
    'input[placeholder="年龄"]',
    'input[aria-label="年龄"]'
  ].join(", "),
  birthdayYear: [
    'div[role="spinbutton"][data-type="year"]',
    'div[aria-label*="年"]',
    'input[name="birthday-year"]'
  ].join(", "),
  birthdayMonth: [
    'div[role="spinbutton"][data-type="month"]',
    'div[aria-label*="月"]',
    'input[name="birthday-month"]'
  ].join(", "),
  birthdayDay: [
    'div[role="spinbutton"][data-type="day"]',
    'div[aria-label*="日"]',
    'input[name="birthday-day"]'
  ].join(", "),
  completeAccountButton: [
    'button[type="submit"]:has-text("完成帐户创建")',
    'button[type="submit"]:has-text("Complete account creation")',
    'button[data-dd-action-name="Continue"][type="submit"]',
    'button[type="submit"]'
  ].join(", ")
};

const defaultEmailVerification: EmailVerificationConfig = {
  enabled: true,
  mailbox: "INBOX",
  codePattern: "\\b(\\d{6})\\b",
  waitTimeoutMs: 30_000,
  resendWaitTimeoutMs: 30_000,
  resendAttempts: 1
};

function normalizeEmailVerificationConfig(
  config: EmailVerificationConfig | undefined
): EmailVerificationConfig {
  if (!config) {
    return defaultEmailVerification;
  }

  const nextConfig: EmailVerificationConfig = {
    ...defaultEmailVerification,
    ...config
  };

  if (!nextConfig.fromIncludes && nextConfig.senderFilter) {
    nextConfig.fromIncludes = nextConfig.senderFilter;
  }

  if (!nextConfig.subjectIncludes && nextConfig.subjectFilter) {
    nextConfig.subjectIncludes = nextConfig.subjectFilter;
  }

  if (typeof nextConfig.codePattern === "string") {
    nextConfig.codePattern = new RegExp(nextConfig.codePattern);
  }

  return nextConfig;
}

const activePlatformContext = readActivePlatformContext();
const activeProfile = activePlatformContext.profile;

const targetProfile: TargetProfile = {
  name: activeProfile.name.trim() || "默认目标画像",
  startUrl: activePlatformContext.site.startUrl,
  expectedOutcomes:
    activeProfile.expectedOutcomes.length
      ? activeProfile.expectedOutcomes
      : DEFAULT_EXPECTED_OUTCOMES,
  grantedPermissions: activeProfile.grantedPermissions ?? [],
  selectors: {
    ...defaultSelectors,
    ...(activeProfile.selectors ?? {})
  },
  emailVerification: normalizeEmailVerificationConfig(activeProfile.emailVerification),
  async prepare(page) {
    // If the site shows a native browser permission prompt,
    // prefer adding that permission to grantedPermissions above
    // instead of manually clicking "Allow" during the test.

    const emailField = page.locator(targetProfile.selectors.email).first();
    const emailAlreadyVisible = await emailField.isVisible().catch(() => false);

    if (emailAlreadyVisible) {
      return page;
    }

    const loginEntry = page.locator(defaultLoginSelector).first();
    const loginVisible = await loginEntry
      .waitFor({
        state: "visible",
        timeout: 20_000
      })
      .then(() => true)
      .catch(() => false);

    if (!loginVisible) {
      return page;
    }

    await loginEntry.scrollIntoViewIfNeeded().catch(() => undefined);
    await loginEntry.click({
      timeout: 15_000
    });

    const dialogSelector = targetProfile.selectors.loginDialog ?? defaultLoginDialogSelector;
    const dialogAppeared = await page
      .locator(dialogSelector)
      .first()
      .waitFor({
        state: "visible",
        timeout: 10_000
      })
      .then(() => true)
      .catch(() => false);

    const activePage = page;
    await activePage.waitForLoadState("domcontentloaded").catch(() => undefined);
    const emailFieldInDialog = activePage
      .locator(
        dialogAppeared
          ? `${dialogSelector} ${targetProfile.selectors.email}`
          : targetProfile.selectors.email
      )
      .first();

    await emailFieldInDialog.waitFor({
      state: "visible",
      timeout: 30_000
    });

    return activePage;
  },
  async fillOptionalFields(_page) {
    // Fill any extra required fields here before submit.
  },
  async afterEmailCodeFilled(_page) {
    // Run any extra actions after the email code has been submitted.
  }
};

export default targetProfile;
