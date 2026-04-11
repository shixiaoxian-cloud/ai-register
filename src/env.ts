import {
  readActivePlatformContext,
  type PlatformBrowserEnvironmentConfig
} from "./config/platform-sqlite";
import type { EmailVerificationConfig } from "./types";

interface BrowserEnvironmentContext {
  config: PlatformBrowserEnvironmentConfig | null;
  summary: string;
  error: string | null;
}

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

function summarizeBrowserEnvironment(
  config: PlatformBrowserEnvironmentConfig | null
): string {
  if (!config) {
    return "未绑定浏览器环境配置";
  }

  const viewportWidth = Number(config.viewport?.width || 0);
  const viewportHeight = Number(config.viewport?.height || 0);
  const viewport = viewportWidth && viewportHeight
    ? `${viewportWidth}x${viewportHeight}`
    : "n/a";
  const geolocation = config.geolocation
    ? `${Number(config.geolocation.latitude || 0).toFixed(4)},${Number(
        config.geolocation.longitude || 0
      ).toFixed(4)}`
    : "n/a";

  return [
    config.name,
    config.browserVersion,
    config.locale,
    config.timezone,
    viewport,
    geolocation
  ].join(" | ");
}

function validateBrowserEnvironment(
  config: PlatformBrowserEnvironmentConfig | null
): BrowserEnvironmentContext {
  if (!config) {
    return {
      config: null,
      summary: "未绑定浏览器环境配置",
      error: "当前活动方案未绑定浏览器环境配置。"
    };
  }

  if (config.approvalStatus !== "approved") {
    return {
      config: null,
      summary: `${config.name} 未通过审批`,
      error: `浏览器环境配置“${config.name}”尚未通过审批，不能执行测试。`
    };
  }

  if (!config.userAgent || !config.browserVersion || !config.locale || !config.timezone) {
    return {
      config: null,
      summary: `${config.name} 缺少关键字段`,
      error: `浏览器环境配置“${config.name}”缺少关键字段，无法执行测试。`
    };
  }

  const viewportWidth = Number(config.viewport?.width || 0);
  const viewportHeight = Number(config.viewport?.height || 0);
  if (!viewportWidth || !viewportHeight) {
    return {
      config: null,
      summary: `${config.name} viewport 无效`,
      error: `浏览器环境配置“${config.name}”缺少有效的 viewport。`
    };
  }

  return {
    config,
    summary: summarizeBrowserEnvironment(config),
    error: null
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const activePlatformContext = readActivePlatformContext();
const activeMailConfig = activePlatformContext.mailConfig;
export const browserEnvironmentContext = validateBrowserEnvironment(
  activePlatformContext.browserEnvironmentConfig
);

export function requireBrowserEnvironment(): PlatformBrowserEnvironmentConfig {
  if (!browserEnvironmentContext.config || browserEnvironmentContext.error) {
    throw new Error(browserEnvironmentContext.error || "浏览器环境配置不可用。");
  }

  return browserEnvironmentContext.config;
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
  telemetryMode: (process.env.TELEMETRY_MODE ?? "block") as
    | "block"
    | "modify"
    | "log"
    | "allow",
  useTempMail: Boolean(
    activeMailConfig?.enabled && activeMailConfig.mode === "temp-mail"
  ),
  browserEnvironmentSummary: browserEnvironmentContext.summary,
  browserEnvironmentApproved: Boolean(browserEnvironmentContext.config),
  browserEnvironmentError: browserEnvironmentContext.error
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
