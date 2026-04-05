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

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function hasImapConfig(): boolean {
  return Boolean(
    process.env.IMAP_HOST &&
      process.env.IMAP_USER &&
      process.env.IMAP_PASS
  );
}

export function getEmailCodeRegex(): RegExp {
  return new RegExp(process.env.EMAIL_CODE_REGEX ?? "\\b(\\d{6})\\b");
}

export const runtimeConfig = {
  headed: parseBoolean(process.env.HEADED, true),
  continueAfterProtectedChallenge: parseBoolean(
    process.env.CONTINUE_AFTER_PROTECTED_CHALLENGE,
    false
  ),
  manualStepTimeoutMs: parseNumber(
    process.env.MANUAL_STEP_TIMEOUT_MS,
    5 * 60 * 1000
  ),
  emailPollIntervalMs: parseNumber(process.env.EMAIL_POLL_INTERVAL_MS, 5_000),
  emailTimeoutMs: parseNumber(process.env.EMAIL_TIMEOUT_MS, 3 * 60 * 1000),
  stealthMode: parseBoolean(process.env.STEALTH_MODE, true),
  telemetryMode: (process.env.TELEMETRY_MODE ?? "block") as "block" | "modify" | "log" | "allow",
  useTempMail: parseBoolean(process.env.USE_TEMP_MAIL, false)
};

export const imapConfig = {
  host: process.env.IMAP_HOST ?? "",
  port: parseNumber(process.env.IMAP_PORT, 993),
  secure: parseBoolean(process.env.IMAP_SECURE, true),
  user: process.env.IMAP_USER ?? "",
  pass: process.env.IMAP_PASS ?? ""
};

export const tempMailConfig = {
  baseUrl: process.env.TEMP_MAIL_BASE_URL ?? "http://114.215.173.42:888",
  apiKey: process.env.TEMP_MAIL_API_KEY ?? "tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"
};

