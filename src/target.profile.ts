import { readTargetSiteConfig } from "./config/target-site";
import type { TargetProfile } from "./types";

const emailSelector = [
  'input#email',
  'input[aria-label="电子邮件地址"]',
  'input[placeholder="电子邮件地址"]',
  'input[name="email"]',
  'input[type="email"]',
  'input[autocomplete*="email"]'
].join(", ");

const loginSelector = [
  'button[data-testid="login-button"]',
  '[data-testid="login-button"]',
  'button:has-text("登录")',
  'a:has-text("登录")',
  'button:has-text("Log in")',
  'a:has-text("Log in")',
  'button:has-text("Sign in")',
  'a:has-text("Sign in")'
].join(", ");

const loginDialogSelector = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-headlessui-state]',
  '[data-radix-popper-content-wrapper]'
].join(", ");

const targetProfile: TargetProfile = {
  name: "replace-with-authorized-target",
  startUrl: readTargetSiteConfig().startUrl,
  expectedOutcomes: ["captcha", "sms_challenge", "device_challenge", "blocked"],
  grantedPermissions: [
    // Common values:
    // "notifications",
    // "geolocation",
    // "camera",
    // "microphone",
    // "clipboard-read",
    // "clipboard-write"
  ],
  selectors: {
    loginDialog: loginDialogSelector,
    email: emailSelector,
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
      'button[data-dd-action-name="Continue"][type="submit"]',
      'button._root_3rdp0_62._primary_3rdp0_107[type="submit"]',
      'button[type="submit"]:has-text("继续")',
      'button[type="submit"]:has-text("Continue")',
      'button[type="submit"]'
    ].join(", "),
    captcha: 'iframe[title*="captcha"], .g-recaptcha, [data-testid="captcha"]',
    smsChallenge: 'input[name="smsCode"], [data-testid="sms-challenge"]',
    deviceChallenge:
      'text=/verify.*device|security check|unusual activity|suspicious login/i',
    success: 'text=/welcome|dashboard|account created|registration complete/i',
    blocked:
      'text=/access denied|temporarily blocked|suspicious activity detected|try again later/i',
    fullName: [
      'input[name="name"]',
      'input[aria-label="全名"]',
      'input[placeholder="全名"]',
      'div._typeableLabelText_18qcl_88:has-text("全名") + input',
      'div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text("全名")) input'
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
  },
  emailVerification: {
    enabled: true,
    mailbox: "INBOX",
    fromIncludes: "no-reply",
    subjectIncludes: "verification"
  },
  async prepare(_page) {
    // If the site shows a native browser permission prompt,
    // prefer adding that permission to grantedPermissions above
    // instead of manually clicking "Allow" during the test.

    const emailField = _page.locator(emailSelector).first();
    const emailAlreadyVisible = await emailField
      .isVisible()
      .catch(() => false);

    if (emailAlreadyVisible) {
      return _page;
    }

    const loginEntry = _page.locator(loginSelector).first();
    const loginVisible = await loginEntry
      .waitFor({
        state: "visible",
        timeout: 20_000
      })
      .then(() => true)
      .catch(() => false);

    if (!loginVisible) {
      return _page;
    }

    await loginEntry.scrollIntoViewIfNeeded().catch(() => undefined);
    await loginEntry.click({
      timeout: 15_000
    });

    const dialogAppeared = await _page
      .locator(loginDialogSelector)
      .first()
      .waitFor({
        state: "visible",
        timeout: 10_000
      })
      .then(() => true)
      .catch(() => false);

    const activePage = _page;

    await activePage.waitForLoadState("domcontentloaded").catch(() => undefined);
    const emailFieldInDialog = activePage
      .locator(
        dialogAppeared
          ? `${loginDialogSelector} ${emailSelector}`
          : emailSelector
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
