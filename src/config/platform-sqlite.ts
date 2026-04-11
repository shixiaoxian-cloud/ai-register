import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  EmailVerificationConfig,
  OutcomeKind,
  TargetSelectors
} from "../types";

type RunMode = "headless" | "headed";

interface SelectionRow {
  selected_plan_id?: string;
}

interface PlanRow {
  id: string;
  name?: string;
  description?: string;
  site_id?: string;
  profile_id?: string;
  mail_config_id?: string | null;
  browser_environment_config_id?: string | null;
  run_mode?: string;
  continue_after_protected_challenge?: number;
  created_at?: string;
  updated_at?: string;
}

interface SiteRow {
  id: string;
  name?: string;
  description?: string;
  start_url?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

interface ProfileRow {
  id: string;
  name?: string;
  description?: string;
  expected_outcomes_json?: string;
  granted_permissions_json?: string;
  selectors_json?: string;
  email_verification_json?: string;
  created_at?: string;
  updated_at?: string;
}

interface MailConfigRow {
  id: string;
  name?: string;
  description?: string;
  mode?: string;
  enabled?: number;
  base_url?: string;
  api_key?: string;
  imap_host?: string;
  imap_port?: number;
  imap_secure?: number;
  imap_user?: string;
  imap_pass?: string;
  created_at?: string;
  updated_at?: string;
}

interface SystemRow {
  default_run_mode?: string;
  continue_after_protected_challenge?: number;
  preferred_landing_page?: string;
  notes?: string;
  updated_at?: string;
}

interface BrowserEnvironmentConfigRow {
  id: string;
  name?: string;
  description?: string;
  source_type?: string;
  source_label?: string;
  approval_status?: string;
  approved_by?: string;
  approved_at?: string;
  approval_note?: string;
  browser_name?: string;
  browser_version?: string;
  platform?: string;
  user_agent?: string;
  user_agent_metadata_json?: string;
  locale?: string;
  languages_json?: string;
  timezone?: string;
  viewport_json?: string;
  screen_json?: string;
  geolocation_json?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformSiteConfig {
  id: string;
  name: string;
  description: string;
  startUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlanConfig {
  id: string;
  name: string;
  description: string;
  siteId: string;
  profileId: string;
  mailConfigId: string;
  browserEnvironmentConfigId: string;
  runMode: RunMode;
  continueAfterProtectedChallenge: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformProfileConfig {
  id: string;
  name: string;
  description: string;
  expectedOutcomes: OutcomeKind[];
  grantedPermissions: string[];
  selectors: Partial<TargetSelectors>;
  emailVerification: EmailVerificationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformMailConfig {
  id: string;
  name: string;
  description: string;
  mode: "temp-mail" | "imap";
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSystemConfig {
  defaultRunMode: RunMode;
  continueAfterProtectedChallenge: boolean;
  preferredLandingPage: string;
  notes: string;
  updatedAt: string;
}

export interface PlatformBrowserEnvironmentConfig {
  id: string;
  name: string;
  description: string;
  sourceType: string;
  sourceLabel: string;
  approvalStatus: string;
  approvedBy: string;
  approvedAt: string;
  browserName: string;
  browserVersion: string;
  platform: string;
  userAgent: string;
  userAgentMetadata: Record<string, unknown>;
  locale: string;
  languages: string[];
  timezone: string;
  viewport: Record<string, unknown>;
  screen: Record<string, unknown>;
  geolocation: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivePlatformContext {
  site: PlatformSiteConfig;
  plan: PlatformPlanConfig;
  profile: PlatformProfileConfig;
  mailConfig: PlatformMailConfig | null;
  browserEnvironmentConfig: PlatformBrowserEnvironmentConfig;
  system: PlatformSystemConfig;
}

export const PLATFORM_SQLITE_PATH = path.resolve(
  process.cwd(),
  "config",
  "platform.sqlite"
);

export const DEFAULT_EXPECTED_OUTCOMES: OutcomeKind[] = [
  "captcha",
  "sms_challenge",
  "device_challenge",
  "blocked",
  "success",
  "unknown"
];

const ALLOWED_OUTCOME_KINDS = new Set<OutcomeKind>([
  "pre_auth_challenge",
  "success",
  "email_code_requested",
  "captcha",
  "sms_challenge",
  "device_challenge",
  "blocked",
  "unknown"
]);

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeBoolean(value: number | undefined, fallback = false): boolean {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Number(value) === 1;
}

function normalizeRunMode(value: string | undefined, fallback: RunMode = "headless"): RunMode {
  return value === "headed" ? "headed" : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean);
}

function normalizeOutcomeKinds(value: unknown): OutcomeKind[] {
  const values = normalizeStringArray(value).filter(
    (entry): entry is OutcomeKind => ALLOWED_OUTCOME_KINDS.has(entry as OutcomeKind)
  );

  return values.length ? values : DEFAULT_EXPECTED_OUTCOMES;
}

function normalizeObject<T extends object>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return value as T;
}

function mapSiteRow(row: SiteRow): PlatformSiteConfig {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    startUrl: String(row.start_url ?? ""),
    status: String(row.status ?? "draft"),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso())
  };
}

function mapPlanRow(row: PlanRow): PlatformPlanConfig {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    siteId: String(row.site_id ?? ""),
    profileId: String(row.profile_id ?? ""),
    mailConfigId: row.mail_config_id ? String(row.mail_config_id) : "",
    browserEnvironmentConfigId: row.browser_environment_config_id
      ? String(row.browser_environment_config_id)
      : "",
    runMode: normalizeRunMode(row.run_mode),
    continueAfterProtectedChallenge: normalizeBoolean(
      row.continue_after_protected_challenge,
      false
    ),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso())
  };
}

function mapProfileRow(row: ProfileRow): PlatformProfileConfig {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    expectedOutcomes: normalizeOutcomeKinds(
      parseJson<unknown[]>(row.expected_outcomes_json, [])
    ),
    grantedPermissions: normalizeStringArray(
      parseJson<unknown[]>(row.granted_permissions_json, [])
    ),
    selectors: normalizeObject<Partial<TargetSelectors>>(
      parseJson<Record<string, string>>(row.selectors_json, {}),
      {}
    ),
    emailVerification: normalizeObject<EmailVerificationConfig>(
      parseJson<Record<string, unknown>>(row.email_verification_json, {}),
      { enabled: true }
    ),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso())
  };
}

function mapMailConfigRow(row: MailConfigRow): PlatformMailConfig {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    mode: row.mode === "imap" ? "imap" : "temp-mail",
    enabled: normalizeBoolean(row.enabled, true),
    baseUrl: String(row.base_url ?? ""),
    apiKey: String(row.api_key ?? ""),
    imapHost: String(row.imap_host ?? ""),
    imapPort: Number(row.imap_port ?? 993),
    imapSecure: normalizeBoolean(row.imap_secure, true),
    imapUser: String(row.imap_user ?? ""),
    imapPass: String(row.imap_pass ?? ""),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso())
  };
}

function mapSystemRow(row: SystemRow | undefined): PlatformSystemConfig {
  return {
    defaultRunMode: normalizeRunMode(row?.default_run_mode, "headless"),
    continueAfterProtectedChallenge: normalizeBoolean(
      row?.continue_after_protected_challenge,
      false
    ),
    preferredLandingPage: String(row?.preferred_landing_page ?? "overview"),
    notes: String(row?.notes ?? ""),
    updatedAt: String(row?.updated_at ?? nowIso())
  };
}

function mapBrowserEnvironmentConfigRow(
  row: BrowserEnvironmentConfigRow
): PlatformBrowserEnvironmentConfig {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    sourceType: String(row.source_type ?? "manual"),
    sourceLabel: String(row.source_label ?? ""),
    approvalStatus: String(row.approval_status ?? "pending"),
    approvedBy: String(row.approved_by ?? ""),
    approvedAt: String(row.approved_at ?? ""),
    browserName: String(row.browser_name ?? ""),
    browserVersion: String(row.browser_version ?? ""),
    platform: String(row.platform ?? ""),
    userAgent: String(row.user_agent ?? ""),
    userAgentMetadata: parseJson<Record<string, unknown>>(
      row.user_agent_metadata_json,
      {}
    ),
    locale: String(row.locale ?? "en-US"),
    languages: normalizeStringArray(parseJson<unknown[]>(row.languages_json, [])),
    timezone: String(row.timezone ?? "UTC"),
    viewport: normalizeObject<Record<string, unknown>>(
      parseJson<Record<string, unknown>>(row.viewport_json, {}),
      {}
    ),
    screen: normalizeObject<Record<string, unknown>>(
      parseJson<Record<string, unknown>>(row.screen_json, {}),
      {}
    ),
    geolocation: parseJson<Record<string, unknown> | null>(row.geolocation_json, null),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso())
  };
}

function getSelectedPlanRow(database: DatabaseSync, selection: SelectionRow | undefined): PlanRow | null {
  if (selection?.selected_plan_id) {
    const selectedRow = database
      .prepare("SELECT * FROM plans WHERE id = ?")
      .get(selection.selected_plan_id) as PlanRow | undefined;

    if (selectedRow) {
      return selectedRow;
    }
  }

  const firstRow = database
    .prepare("SELECT * FROM plans ORDER BY datetime(created_at) ASC, id ASC LIMIT 1")
    .get() as PlanRow | undefined;

  return firstRow ?? null;
}

export function readActivePlatformContext(): ActivePlatformContext {
  if (!existsSync(PLATFORM_SQLITE_PATH)) {
    throw new Error(
      "未找到 SQLite 配置库 config/platform.sqlite。请先启动控制台并完成配置保存。"
    );
  }

  const database = new DatabaseSync(PLATFORM_SQLITE_PATH);

  try {
    const selection = database
      .prepare("SELECT * FROM selection_state WHERE singleton = 1")
      .get() as SelectionRow | undefined;
    const planRow = getSelectedPlanRow(database, selection);

    if (!planRow) {
      throw new Error("SQLite 中尚未配置任何测试方案。请先在控制台创建方案。");
    }

    const siteRow = database
      .prepare("SELECT * FROM sites WHERE id = ?")
      .get(String(planRow.site_id ?? "")) as SiteRow | undefined;
    const profileRow = database
      .prepare("SELECT * FROM profiles WHERE id = ?")
      .get(String(planRow.profile_id ?? "")) as ProfileRow | undefined;
    const mailConfigRow = planRow.mail_config_id
      ? (database
          .prepare("SELECT * FROM mail_configs WHERE id = ?")
          .get(String(planRow.mail_config_id)) as MailConfigRow | undefined)
      : undefined;
    const browserEnvironmentConfigRow = planRow.browser_environment_config_id
      ? (database
          .prepare("SELECT * FROM browser_environment_configs WHERE id = ?")
          .get(String(planRow.browser_environment_config_id)) as
            | BrowserEnvironmentConfigRow
            | undefined)
      : undefined;
    const systemRow = database
      .prepare("SELECT * FROM system_settings WHERE singleton = 1")
      .get() as SystemRow | undefined;

    if (!siteRow) {
      throw new Error(`当前活动方案关联的站点不存在：${String(planRow.site_id ?? "")}`);
    }

    if (!profileRow) {
      throw new Error(`当前活动方案关联的画像不存在：${String(planRow.profile_id ?? "")}`);
    }

    if (!browserEnvironmentConfigRow) {
      throw new Error(
        `当前活动方案关联的浏览器环境配置不存在：${String(planRow.browser_environment_config_id ?? "")}`
      );
    }

    return {
      site: mapSiteRow(siteRow),
      plan: mapPlanRow(planRow),
      profile: mapProfileRow(profileRow),
      mailConfig: mailConfigRow ? mapMailConfigRow(mailConfigRow) : null,
      browserEnvironmentConfig: mapBrowserEnvironmentConfigRow(browserEnvironmentConfigRow),
      system: mapSystemRow(systemRow)
    };
  } finally {
    database.close();
  }
}
