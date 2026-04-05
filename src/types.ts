import type { Page } from "@playwright/test";

export type OutcomeKind =
  | "pre_auth_challenge"
  | "success"
  | "email_code_requested"
  | "captcha"
  | "sms_challenge"
  | "device_challenge"
  | "blocked"
  | "unknown";

export type FlowStage =
  | "before_login"
  | "credentials_submitted"
  | "email_submitted"
  | "password_submitted"
  | "email_verification_submitted"
  | "after_manual_challenge";

export interface TargetSelectors {
  loginDialog?: string;
  email: string;
  password?: string;
  submit: string;
  emailCodeInput?: string;
  emailCodeSubmit?: string;
  captcha?: string;
  smsChallenge?: string;
  deviceChallenge?: string;
  success?: string;
  blocked?: string;
}

export interface EmailVerificationConfig {
  enabled: boolean;
  mailbox?: string;
  fromIncludes?: string;
  subjectIncludes?: string;
}

export interface OutcomeRecord {
  stage: FlowStage;
  stageLabel: string;
  kind: OutcomeKind;
  details: string;
  observedAt: string;
  url?: string;
}

export interface TargetProfile {
  name: string;
  startUrl: string;
  expectedOutcomes: OutcomeKind[];
  selectors: TargetSelectors;
  grantedPermissions?: string[];
  permissionOrigin?: string;
  emailVerification?: EmailVerificationConfig;
  prepare?: (page: Page) => Promise<Page | void>;
  fillOptionalFields?: (page: Page) => Promise<void>;
  afterEmailCodeFilled?: (page: Page) => Promise<void>;
}
