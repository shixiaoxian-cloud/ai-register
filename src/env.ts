import { readActivePlatformContext } from "./config/platform-sqlite";
import type { EmailVerificationConfig } from "./types";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "true" || value === "1";
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number but received "${value}".`);
  }

  return parsed;
}

function resolveEmailCodeRegex(pattern: string | RegExp | undefined): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  if (typeof pattern === "string" && pattern.trim()) {
    return new RegExp(pattern);
  }

  return /\b(\d{6})\b/;
}

const activePlatformContext = readActivePlatformContext();
const activeMailConfig = activePlatformContext.mailConfig;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function hasImapConfig(): boolean {
  return Boolean(
    activeMailConfig?.enabled &&
      activeMailConfig.mode === "imap" &&
      activeMailConfig.imapHost &&
      activeMailConfig.imapUser &&
      activeMailConfig.imapPass
  );
}

export function getEmailCodeRegex(
  emailVerification?: EmailVerificationConfig
): RegExp {
  return resolveEmailCodeRegex(
    emailVerification?.codePattern ??
      activePlatformContext.profile.emailVerification?.codePattern
  );
}

export const runtimeConfig = {
  headed:
    parseBoolean(process.env.HEADED, false) ||
    activePlatformContext.plan.runMode === "headed" ||
    activePlatformContext.system.defaultRunMode === "headed",
  continueAfterProtectedChallenge:
    activePlatformContext.plan.continueAfterProtectedChallenge ||
    activePlatformContext.system.continueAfterProtectedChallenge,
  manualStepTimeoutMs: parseNumber(
    process.env.MANUAL_STEP_TIMEOUT_MS,
    5 * 60 * 1000
  ),
  emailPollIntervalMs: parseNumber(process.env.EMAIL_POLL_INTERVAL_MS, 5_000),
  emailTimeoutMs: parseNumber(process.env.EMAIL_TIMEOUT_MS, 3 * 60 * 1000),
  stealthMode: parseBoolean(process.env.STEALTH_MODE, true),
  telemetryMode: (process.env.TELEMETRY_MODE ?? "block") as
    | "block"
    | "modify"
    | "log"
    | "allow",
  useTempMail: Boolean(
    activeMailConfig?.enabled && activeMailConfig.mode === "temp-mail"
  )
};

export const imapConfig = {
  host:
    activeMailConfig?.enabled && activeMailConfig.mode === "imap"
      ? activeMailConfig.imapHost
      : "",
  port:
    activeMailConfig?.enabled && activeMailConfig.mode === "imap"
      ? activeMailConfig.imapPort
      : 993,
  secure:
    activeMailConfig?.enabled && activeMailConfig.mode === "imap"
      ? activeMailConfig.imapSecure
      : true,
  user:
    activeMailConfig?.enabled && activeMailConfig.mode === "imap"
      ? activeMailConfig.imapUser
      : "",
  pass:
    activeMailConfig?.enabled && activeMailConfig.mode === "imap"
      ? activeMailConfig.imapPass
      : ""
};

export const tempMailConfig = {
  baseUrl:
    activeMailConfig?.enabled && activeMailConfig.mode === "temp-mail"
      ? activeMailConfig.baseUrl
      : "",
  apiKey:
    activeMailConfig?.enabled && activeMailConfig.mode === "temp-mail"
      ? activeMailConfig.apiKey
      : ""
};
