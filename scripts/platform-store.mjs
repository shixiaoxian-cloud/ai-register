import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { scanArtifactEntries } from "./platform-artifacts.mjs";
import { buildZipBuffer } from "./zip-bundle.mjs";

const SAFE_BYPASS_PATTERNS = [
  /captcha\s*bypass/i,
  /sms\s*bypass/i,
  /device\s*bypass/i,
  /turnstile\s*solver/i,
  /fingerprint\s*spoof/i,
  /browser\s*farm/i,
  /\bbypass\b/i
];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function parseStoredJson(value, fallback) {
  if (typeof value !== "string" || !value.trim()) {
    return clone(fallback);
  }

  return safeJsonParse(value, clone(fallback));
}

function decodeBlobUtf8(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function parseArtifactJsonBlob(value) {
  const rawText = decodeBlobUtf8(value).replace(/^\uFEFF/, "").trim();
  if (!rawText) {
    throw new Error("产物内容为空。");
  }

  return JSON.parse(rawText);
}

function convertCpaPayloadToSub2ApiAccount(cpaData) {
  if (!cpaData?.type || !cpaData?.credentials) {
    return null;
  }

  return {
    name: cpaData.email || cpaData.name,
    notes: "",
    platform: cpaData.platform || "openai",
    type: "oauth",
    credentials: {
      access_token: cpaData.credentials.access_token || cpaData.access_token,
      refresh_token: cpaData.credentials.refresh_token || cpaData.refresh_token || "",
      expires_in: cpaData.credentials.expires_in || 863999,
      expires_at: cpaData.credentials.expires_at,
      chatgpt_account_id: cpaData.credentials.chatgpt_account_id || cpaData.chatgpt_account_id,
      chatgpt_user_id: cpaData.credentials.chatgpt_user_id || cpaData.chatgpt_user_id,
      organization_id: cpaData.credentials.organization_id || cpaData.organization_id || "",
      client_id: "app_EMoamEEZ73f0CkXaXp7hrann",
      model_mapping: {
        "gpt-5.1": "gpt-5.1",
        "gpt-5.1-codex": "gpt-5.1-codex",
        "gpt-5.1-codex-max": "gpt-5.1-codex-max",
        "gpt-5.1-codex-mini": "gpt-5.1-codex-mini",
        "gpt-5.2": "gpt-5.2",
        "gpt-5.2-codex": "gpt-5.2-codex",
        "gpt-5.3": "gpt-5.3",
        "gpt-5.3-codex": "gpt-5.3-codex",
        "gpt-5.4": "gpt-5.4",
        "gpt-5.4-mini": "gpt-5.4-mini"
      }
    },
    extra: {
      email: cpaData.extra?.email || cpaData.email,
      password: cpaData.extra?.password || ""
    },
    group_ids: [2],
    concurrency: 10,
    priority: 1,
    rate_multiplier: 1,
    auto_pause_on_expired: true
  };
}

function serializeJson(value) {
  return JSON.stringify(value ?? null);
}

function sqliteBoolean(value) {
  return value ? 1 : 0;
}

function normalizeSqliteBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return Number(value) === 1;
}

async function ensureParentDirectory(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJson(filePath, fallback) {
  if (!existsSync(filePath)) {
    return clone(fallback);
  }

  const rawText = await readFile(filePath, "utf8");
  return safeJsonParse(rawText, clone(fallback));
}

async function writeJson(filePath, payload) {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function normalizeExpectedOutcomes(values) {
  if (!Array.isArray(values)) {
    return ["captcha", "sms_challenge", "device_challenge", "blocked", "success", "unknown"];
  }

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function normalizeObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return clone(fallback);
  }

  return clone(value);
}

function normalizePreferredLandingPage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  switch (normalized) {
    case "runs":
    case "config":
    case "overview":
      return normalized;
    default:
      return "overview";
  }
}

function readEnvValue(envText, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = envText.match(new RegExp(`^${escapedKey}=(.*)$`, "m"));

  if (!match) {
    return "";
  }

  return String(match[1] || "").trim();
}

export function validateHttpsUrl(input) {
  let parsed;

  try {
    parsed = new URL(String(input ?? "").trim());
  } catch {
    throw new Error("请输入完整且有效的地址，例如 https://example.com/register");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("当前仅接受 https:// 地址。");
  }

  if (!parsed.hostname) {
    throw new Error("地址中缺少有效域名。");
  }

  return parsed.toString();
}

function assertSafeConfig(value, trail = "config") {
  if (typeof value === "string") {
    for (const pattern of SAFE_BYPASS_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`配置包含不允许的绕过式描述：${trail}`);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeConfig(item, `${trail}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assertSafeConfig(nestedValue, `${trail}.${key}`);
  }
}

function getDefaultProfileConfig() {
  return {
    name: "默认 ChatGPT 认证画像",
    expectedOutcomes: [
      "captcha",
      "sms_challenge",
      "device_challenge",
      "blocked",
      "success",
      "unknown"
    ],
    grantedPermissions: [],
    selectors: {
      loginDialog:
        "[role=\"dialog\"], [aria-modal=\"true\"], [data-headlessui-state], [data-radix-popper-content-wrapper]",
      email:
        "input#email, input[aria-label=\"电子邮件地址\"], input[placeholder=\"电子邮件地址\"], input[name=\"email\"], input[type=\"email\"], input[autocomplete*=\"email\"]",
      password:
        "input[type=\"password\"], input[name=\"password\"], input[aria-label=\"密码\"], input[placeholder=\"密码\"], div._typeableLabelText_18qcl_88:has-text(\"密码\") + input, div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text(\"密码\")) input",
      submit: "button[type=\"submit\"]",
      emailCodeInput:
        "input[name=\"verificationCode\"], input[name=\"code\"], input[aria-label=\"Code\"], input[placeholder=\"Code\"], div._typeableLabelText_18qcl_88:has-text(\"Code\") + input, div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text(\"Code\")) input",
      emailCodeSubmit:
        "button[type=\"submit\"][name=\"intent\"][value=\"validate\"], button[data-dd-action-name=\"Continue\"][type=\"submit\"]:not([value=\"resend\"]), button._root_3rdp0_62._primary_3rdp0_107[type=\"submit\"]:has-text(\"Continue\"), button[type=\"submit\"]:has-text(\"继续\"), button[type=\"submit\"]:has-text(\"Continue\"):not(:has-text(\"Resend\"))",
      captcha: "iframe[title*=\"captcha\"], .g-recaptcha, [data-testid=\"captcha\"]",
      smsChallenge: "input[name=\"smsCode\"], [data-testid=\"sms-challenge\"]",
      deviceChallenge: "text=/verify.*device|security check|unusual activity|suspicious login/i",
      success:
        "text=/Ready when you are/i, text=/What brings you to ChatGPT/i, text=/New chat/i, text=/welcome|dashboard|account created|registration complete/i",
      blocked: "text=/access denied|temporarily blocked|suspicious activity detected|try again later/i",
      fullName:
        "input[name=\"name\"], input[aria-label=\"全名\"], input[placeholder=\"全名\"], div._typeableLabelText_18qcl_88:has-text(\"全名\") + input, div._typeableLabelTextPositioner_18qcl_88:has(div._typeableLabelText_18qcl_88:has-text(\"全名\")) input",
      birthdayYear:
        "div[role=\"spinbutton\"][data-type=\"year\"], div[aria-label*=\"年\"], input[name=\"birthday-year\"]",
      birthdayMonth:
        "div[role=\"spinbutton\"][data-type=\"month\"], div[aria-label*=\"月\"], input[name=\"birthday-month\"]",
      birthdayDay:
        "div[role=\"spinbutton\"][data-type=\"day\"], div[aria-label*=\"日\"], input[name=\"birthday-day\"]",
      completeAccountButton:
        "button[type=\"submit\"]:has-text(\"完成帐户创建\"), button[type=\"submit\"]:has-text(\"Complete account creation\"), button[data-dd-action-name=\"Continue\"][type=\"submit\"], button[type=\"submit\"]"
    },
    emailVerification: {
      enabled: true,
      mailbox: "INBOX",
      fromIncludes: "no-reply",
      subjectIncludes: "verification",
      senderFilter: "no-reply",
      subjectFilter: "verification",
      codePattern: "\\b(\\d{6})\\b"
    }
  };
}

function normalizeProfileRecord(record) {
  return {
    id: String(record.id || createId("profile")),
    name: String(record.name || "未命名画像").trim(),
    description: String(record.description || "").trim(),
    expectedOutcomes: normalizeExpectedOutcomes(record.expectedOutcomes),
    grantedPermissions: normalizeStringArray(record.grantedPermissions),
    selectors: normalizeObject(record.selectors),
    emailVerification: normalizeObject(record.emailVerification),
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function normalizeMailConfig(record) {
  return {
    id: String(record.id || createId("mail")),
    name: String(record.name || "未命名邮箱配置").trim(),
    description: String(record.description || "").trim(),
    mode: record.mode === "imap" ? "imap" : "temp-mail",
    enabled: parseBoolean(record.enabled, true),
    baseUrl: String(record.baseUrl || "").trim(),
    apiKey: String(record.apiKey || "").trim(),
    imapHost: String(record.imapHost || "").trim(),
    imapPort: parseNumber(record.imapPort, 993),
    imapSecure: parseBoolean(record.imapSecure, true),
    imapUser: String(record.imapUser || "").trim(),
    imapPass: String(record.imapPass || "").trim(),
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function normalizeSiteRecord(record) {
  const startUrl = record.startUrl ? validateHttpsUrl(record.startUrl) : "";
  return {
    id: String(record.id || createId("site")),
    name: String(record.name || "未命名站点").trim(),
    description: String(record.description || "").trim(),
    startUrl,
    status: startUrl ? "ready" : "draft",
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function normalizePlanRecord(record, state) {
  const siteId =
    String(record.siteId || state.selectedSiteId || state.sites[0]?.id || "").trim();
  const profileId =
    String(record.profileId || state.selectedProfileId || state.profiles[0]?.id || "").trim();
  const mailConfigId =
    String(record.mailConfigId || state.selectedMailConfigId || state.mailConfigs[0]?.id || "").trim();

  if (!siteId) {
    throw new Error("测试方案必须关联一个站点。");
  }

  if (!profileId) {
    throw new Error("测试方案必须关联一个画像配置。");
  }

  return {
    id: String(record.id || createId("plan")),
    name: String(record.name || "未命名方案").trim(),
    description: String(record.description || "").trim(),
    siteId,
    profileId,
    mailConfigId,
    runMode: record.runMode === "headed" ? "headed" : "headless",
    continueAfterProtectedChallenge: parseBoolean(
      record.continueAfterProtectedChallenge,
      false
    ),
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso()
  };
}

function normalizeLogEntries(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((entry) => ({
      at: String(entry?.at || nowIso()),
      stream: String(entry?.stream || "system"),
      text: String(entry?.text || "")
    }))
    .filter((entry) => entry.text);
}

function normalizeStructuredRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return clone(value);
}

function normalizeRunRecord(record) {
  const currentTime = nowIso();
  return {
    id: String(record.id || createId("run")),
    taskId: record.taskId ? String(record.taskId).trim() : "",
    caseId: record.caseId ? String(record.caseId).trim() : "",
    planId: String(record.planId || "").trim(),
    planName: String(record.planName || "").trim(),
    siteId: String(record.siteId || "").trim(),
    siteName: String(record.siteName || "").trim(),
    profileId: String(record.profileId || "").trim(),
    mailConfigId: record.mailConfigId ? String(record.mailConfigId).trim() : null,
    status: String(record.status || "idle").trim() || "idle",
    mode: record.mode === "headed" ? "headed" : "headless",
    summary: String(record.summary || "").trim(),
    command: String(record.command || "").trim(),
    startedAt: String(record.startedAt || currentTime),
    finishedAt: String(record.finishedAt || ""),
    exitCode: parseNumber(record.exitCode, null),
    logs: normalizeLogEntries(record.logs),
    latestStage: normalizeStructuredRecord(record.latestStage),
    insight: normalizeStructuredRecord(record.insight),
    conclusion: normalizeStructuredRecord(record.conclusion),
    artifactKeys: normalizeStringArray(record.artifactKeys),
    reportAvailable: parseBoolean(record.reportAvailable, false),
    pid: parseNumber(record.pid, null),
    createdAt: String(record.createdAt || record.startedAt || currentTime),
    updatedAt: String(record.updatedAt || currentTime)
  };
}

function toPublicRunRecord(record) {
  const { createdAt, updatedAt, ...publicRecord } = normalizeRunRecord(record);
  return publicRecord;
}

function stableId(prefix, value) {
  return `${prefix}-${createHash("sha1").update(String(value || "")).digest("hex").slice(0, 16)}`;
}

function buildRunTaskId(runId) {
  return stableId("task", `run:${runId}`);
}

function buildRunCaseId(runId) {
  return stableId("case", `run:${runId}`);
}

function buildArtifactCaseId(caseKey, runId = "") {
  return stableId("case", runId ? `run:${runId}:case:${caseKey}` : `legacy:case:${caseKey}`);
}

function parseTimestampMs(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function parseRetryIndex(caseKey) {
  const match = String(caseKey || "").match(/-retry(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function buildArtifactHref(artifactId, artifactType, relPath) {
  if (artifactType === "report" && relPath === "index.html") {
    return "/report";
  }

  return `/platform-artifacts/${encodeURIComponent(artifactId)}`;
}

function sanitizeFileSegment(value, fallback = "item") {
  const normalized = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function normalizeBundlePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.(\/|\\)/g, "")
    .replace(/\/{2,}/g, "/");
}

function inferArtifactContentType(entry) {
  const extension = path.extname(entry.relPath || "").toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
    case ".log":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webm":
      return "video/webm";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function inferArtifactStorageKind(entry) {
  const extension = path.extname(entry.relPath || "").toLowerCase();

  if (extension === ".json") {
    return "json";
  }

  if ([".md", ".txt", ".log", ".html"].includes(extension)) {
    return "text";
  }

  return "blob";
}

function hashContent(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function detectArtifactCaseKey(entry) {
  if (!["logs", "media", "trace"].includes(String(entry.bucket || ""))) {
    return "";
  }

  const [firstSegment] = String(entry.relPath || "").split("/");
  if (!firstSegment || firstSegment.startsWith(".playwright-artifacts-")) {
    return "";
  }

  return firstSegment;
}

function normalizeTaskRecord(record) {
  const currentTime = nowIso();
  return {
    id: String(record.id || createId("task")),
    name: String(record.name || "未命名任务").trim(),
    status: normalizeTaskStatus(record.status),
    sourceKind: String(record.sourceKind || "synthetic").trim() || "synthetic",
    sourceRef: String(record.sourceRef || "").trim(),
    createdAt: String(record.createdAt || currentTime),
    updatedAt: String(record.updatedAt || currentTime)
  };
}

function normalizeCaseRecord(record) {
  const currentTime = nowIso();
  return {
    id: String(record.id || createId("case")),
    taskId: String(record.taskId || "").trim(),
    name: String(record.name || "默认用例").trim(),
    status: normalizeCaseStatus(record.status),
    sourceKind: String(record.sourceKind || "synthetic").trim() || "synthetic",
    sourceRef: String(record.sourceRef || "").trim(),
    createdAt: String(record.createdAt || currentTime),
    updatedAt: String(record.updatedAt || currentTime)
  };
}

function normalizeTaskStatus(value) {
  const status = String(value || "").trim();

  switch (status) {
    case "running":
    case "stopping":
      return "running";
    case "passed":
    case "success":
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "stopped":
      return "stopped";
    default:
      return "pending";
  }
}

function normalizeCaseStatus(value) {
  const status = String(value || "").trim();

  switch (status) {
    case "retrying":
      return "retrying";
    case "running":
    case "stopping":
      return "running";
    case "passed":
    case "success":
    case "completed":
      return "success";
    case "failed":
      return "failed";
    case "stopped":
      return "stopped";
    default:
      return "pending";
  }
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function parseRepeatEachCount(command) {
  const match = String(command || "").match(/--repeat-each=(\d+)/);
  const parsed = match ? Number(match[1]) : 1;
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

function parseCaseSequenceFromResultLine(text) {
  const stripped = stripAnsi(text).trim();
  const match = stripped.match(
    /^(?:✓|✘|ok|x)\s+(\d+)\s+tests[\\/]+protection-validation\.spec\.ts:\d+:\d+/i
  );

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isSuccessfulResultLine(text) {
  const stripped = stripAnsi(text).trim();
  return /^(?:✓|ok)\s+\d+\s+tests[\\/]+protection-validation\.spec\.ts:\d+:\d+/i.test(stripped);
}

function detectLatestStageFromLogs(logEntries) {
  if (!Array.isArray(logEntries)) {
    return null;
  }

  for (let index = logEntries.length - 1; index >= 0; index -= 1) {
    const text = String(logEntries[index]?.text || "");
    const match = text.match(/^\[STAGE\]\s(.+?)\s\|\s(.+?)\s\|\s(.*?)\s\|\s(.+)$/);

    if (match) {
      return {
        stageLabel: match[1],
        outcomeKind: match[2],
        url: match[3],
        details: match[4]
      };
    }
  }

  return null;
}

function extractRetrySummaryFromLogs(logEntries) {
  let maxAttempt = 1;
  let maxTotal = 1;

  for (const entry of logEntries || []) {
    const match = String(entry?.text || "").match(
      /\[Run\]\sStarting registration attempt\s+(\d+)\s*\/\s*(\d+)/
    );

    if (!match) {
      continue;
    }

    maxAttempt = Math.max(maxAttempt, Number(match[1]) || 1);
    maxTotal = Math.max(maxTotal, Number(match[2]) || 1);
  }

  return {
    retryCount: Math.max(0, maxAttempt - 1),
    maxRetries: Math.max(0, maxTotal - 1)
  };
}

function extractFailureMessageFromLogs(logEntries) {
  for (let index = logEntries.length - 1; index >= 0; index -= 1) {
    const text = stripAnsi(logEntries[index]?.text || "").trim();
    if (!text) {
      continue;
    }

    if (/^(?:TypeError|ReferenceError|RangeError|SyntaxError|AssertionError|TimeoutError|Error):/i.test(text)) {
      return text;
    }

    if (/执行失败|失败或异常|启动测试失败|cannot read properties|timed out|timeout/i.test(text)) {
      return text;
    }
  }

  return "执行失败";
}

function buildDerivedCaseRunRecord(parentRun, caseId, sequence, status, logEntries, latestStage, errorMessage) {
  return {
    ...parentRun,
    id: `${parentRun.id}::repeat-${sequence}`,
    caseId,
    status:
      status === "success"
        ? "passed"
        : status === "running"
          ? "running"
          : status === "stopped"
            ? "stopped"
            : status === "failed"
              ? "failed"
              : "idle",
    summary:
      status === "success"
        ? `第 ${sequence} 次执行已完成。`
        : status === "failed"
          ? errorMessage || `第 ${sequence} 次执行失败。`
          : status === "running"
            ? `第 ${sequence} 次执行进行中。`
            : status === "stopped"
              ? `第 ${sequence} 次执行已停止。`
              : `第 ${sequence} 次执行待开始。`,
    logs: logEntries,
    latestStage,
    insight: null,
    conclusion: null,
    artifactKeys: [],
    reportAvailable: sequence === parseRepeatEachCount(parentRun.command) ? parentRun.reportAvailable : false,
    pid: status === "running" ? parentRun.pid : null
  };
}

function buildDerivedRepeatCasesFromRun(runRecord, taskId) {
  const expectedCaseCount = parseRepeatEachCount(runRecord.command);
  if (expectedCaseCount <= 1) {
    return [];
  }

  const logEntries = Array.isArray(runRecord.logs) ? runRecord.logs : [];
  const chunks = [];
  let currentChunkLogs = [];

  for (const entry of logEntries) {
    currentChunkLogs.push(entry);
    const sequence = parseCaseSequenceFromResultLine(entry.text);

    if (!sequence) {
      continue;
    }

    chunks.push({
      sequence,
      logs: currentChunkLogs,
      hasResult: true
    });
    currentChunkLogs = [];
  }

  if (currentChunkLogs.length) {
    if (chunks.length < expectedCaseCount) {
      chunks.push({
        sequence: (chunks[chunks.length - 1]?.sequence || 0) + 1,
        logs: currentChunkLogs,
        hasResult: false
      });
    } else if (chunks.length) {
      chunks[chunks.length - 1].logs.push(...currentChunkLogs);
    }
  }

  const chunkBySequence = new Map(chunks.map((chunk) => [chunk.sequence, chunk]));
  const derivedCases = [];

  for (let sequence = 1; sequence <= expectedCaseCount; sequence += 1) {
    const chunk = chunkBySequence.get(sequence);
    const caseId = stableId("case", `${runRecord.id}:repeat:${sequence}`);
    const chunkLogs = chunk?.logs || [];
    const latestStage = detectLatestStageFromLogs(chunkLogs);
    const retrySummary = extractRetrySummaryFromLogs(chunkLogs);
    let status = "pending";

    if (chunk?.hasResult) {
      status = isSuccessfulResultLine(chunkLogs[chunkLogs.length - 1]?.text)
        ? "success"
        : "failed";
    } else if (chunkLogs.length) {
      if (runRecord.status === "running" || runRecord.status === "stopping") {
        status = "running";
      } else if (runRecord.status === "stopped") {
        status = "stopped";
      } else if (runRecord.status === "failed") {
        status = "failed";
      } else if (runRecord.status === "passed") {
        status = "success";
      }
    } else if (runRecord.status === "running" || runRecord.status === "stopping") {
      // 如果 run 正在运行，但这个 case 还没有日志，说明它在等待执行
      // 对于第一个 case，应该标记为 running；其他 case 保持 pending
      status = sequence === 1 ? "running" : "pending";
    }

    const startedAt = String(chunkLogs[0]?.at || "");
    const finishedAt =
      status === "pending" || status === "running"
        ? ""
        : String(chunkLogs[chunkLogs.length - 1]?.at || runRecord.finishedAt || "");
    const errorMessage = status === "failed" ? extractFailureMessageFromLogs(chunkLogs) : undefined;

    derivedCases.push({
      id: caseId,
      taskId: String(taskId || runRecord.taskId || ""),
      name: `case-${sequence}`,
      sequence,
      status,
      sourceKind: "derived-repeat-case",
      sourceRef: runRecord.id,
      startedAt,
      finishedAt,
      retryCount: retrySummary.retryCount,
      maxRetries: retrySummary.maxRetries,
      exitCode:
        status === "success"
          ? 0
          : status === "failed"
            ? (runRecord.exitCode ?? 1)
            : undefined,
      errorType: status === "failed" ? "unknown" : undefined,
      errorMessage,
      errorStack: undefined,
      createdAt: startedAt || String(runRecord.startedAt || nowIso()),
      updatedAt: String(chunkLogs[chunkLogs.length - 1]?.at || runRecord.finishedAt || runRecord.startedAt || nowIso()),
      runCount: chunkLogs.length ? 1 : 0,
      artifactCount: 0,
      runs: chunkLogs.length
        ? [
            buildDerivedCaseRunRecord(
              runRecord,
              caseId,
              sequence,
              status,
              chunkLogs,
              latestStage,
              errorMessage
            )
          ]
        : [],
      latestStage
    });
  }

  return derivedCases;
}

function getArtifactStorageKind(relPath) {
  const extension = path.extname(String(relPath || "")).toLowerCase();

  if (extension === ".zip") {
    return "zip";
  }

  if ([
    ".json",
    ".txt",
    ".md",
    ".html",
    ".css",
    ".js",
    ".mjs",
    ".svg",
    ".webmanifest"
  ].includes(extension)) {
    return extension === ".json" ? "json" : "text";
  }

  return "blob";
}

function getArtifactContentType(relPath) {
  const extension = path.extname(String(relPath || "")).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webm":
      return "video/webm";
    case ".zip":
      return "application/zip";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
    case ".log":
    case ".trace":
    case ".network":
      return "text/plain; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function normalizeArtifactRecord(record) {
  const currentTime = nowIso();
  return {
    id: String(record.id || createId("artifact")),
    taskId: record.taskId ? String(record.taskId).trim() : "",
    caseId: record.caseId ? String(record.caseId).trim() : "",
    runId: record.runId ? String(record.runId).trim() : "",
    ownerType: String(record.ownerType || (record.runId ? "run" : record.caseId ? "case" : record.taskId ? "task" : "run")).trim(),
    ownerId: String(record.ownerId || record.runId || record.caseId || record.taskId || "").trim(),
    bucket: String(record.bucket || "").trim(),
    type: String(record.type || "log").trim(),
    name: String(record.name || "").trim(),
    relPath: String(record.relPath || "").trim(),
    contentType: String(record.contentType || getArtifactContentType(record.relPath || "")).trim(),
    storageKind: String(record.storageKind || getArtifactStorageKind(record.relPath || "")).trim(),
    sizeBytes: parseNumber(record.sizeBytes, 0),
    modifiedAt: String(record.modifiedAt || currentTime),
    sourcePath: String(record.sourcePath || "").trim(),
    contentBuffer: Buffer.isBuffer(record.contentBuffer)
      ? record.contentBuffer
      : Buffer.isBuffer(record.content)
        ? record.content
        : Buffer.from(record.content || ""),
    createdAt: String(record.createdAt || currentTime),
    updatedAt: String(record.updatedAt || currentTime)
  };
}

function getDefaultSystemState() {
  return {
    defaultRunMode: "headless",
    continueAfterProtectedChallenge: false,
    preferredLandingPage: normalizePreferredLandingPage("overview"),
    notes: "",
    updatedAt: nowIso()
  };
}

function normalizeState(rawState) {
  const currentTime = nowIso();
  const state = {
    version: Number(rawState.version || 2),
    selectedSiteId: String(rawState.selectedSiteId || "").trim(),
    selectedPlanId: String(rawState.selectedPlanId || "").trim(),
    selectedProfileId: String(rawState.selectedProfileId || "").trim(),
    selectedMailConfigId: String(rawState.selectedMailConfigId || "").trim(),
    sites: Array.isArray(rawState.sites)
      ? rawState.sites.map((record) => normalizeSiteRecord(record))
      : [],
    profiles: Array.isArray(rawState.profiles)
      ? rawState.profiles.map((record) => normalizeProfileRecord(record))
      : [],
    mailConfigs: Array.isArray(rawState.mailConfigs)
      ? rawState.mailConfigs.map((record) => normalizeMailConfig(record))
      : [],
    plans: [],
    system: {
      defaultRunMode: rawState.system?.defaultRunMode === "headed" ? "headed" : "headless",
      continueAfterProtectedChallenge: parseBoolean(
        rawState.system?.continueAfterProtectedChallenge,
        false
      ),
      preferredLandingPage: normalizePreferredLandingPage(rawState.system?.preferredLandingPage),
      notes: String(rawState.system?.notes || ""),
      updatedAt: rawState.system?.updatedAt || currentTime
    },
    updatedAt: rawState.updatedAt || currentTime
  };

  state.plans = Array.isArray(rawState.plans)
    ? rawState.plans.map((record) => normalizePlanRecord(record, state))
    : [];

  if (!state.sites.length || !state.profiles.length || !state.mailConfigs.length || !state.plans.length) {
    throw new Error("平台资源为空，需重新引导初始化。");
  }

  state.selectedSiteId = state.selectedSiteId || state.sites[0].id;
  state.selectedProfileId = state.selectedProfileId || state.profiles[0].id;
  state.selectedMailConfigId = state.selectedMailConfigId || state.mailConfigs[0].id;
  state.selectedPlanId = state.selectedPlanId || state.plans[0].id;
  return state;
}

function mapSiteRow(row) {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    startUrl: String(row.start_url || ""),
    status: String(row.status || "draft"),
    createdAt: String(row.created_at || nowIso()),
    updatedAt: String(row.updated_at || nowIso())
  };
}

function mapProfileRow(row) {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    expectedOutcomes: parseStoredJson(row.expected_outcomes_json, []),
    grantedPermissions: parseStoredJson(row.granted_permissions_json, []),
    selectors: parseStoredJson(row.selectors_json, {}),
    emailVerification: parseStoredJson(row.email_verification_json, {}),
    createdAt: String(row.created_at || nowIso()),
    updatedAt: String(row.updated_at || nowIso())
  };
}

function mapMailConfigRow(row) {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    mode: row.mode === "imap" ? "imap" : "temp-mail",
    enabled: normalizeSqliteBoolean(row.enabled, true),
    baseUrl: String(row.base_url || ""),
    apiKey: String(row.api_key || ""),
    imapHost: String(row.imap_host || ""),
    imapPort: parseNumber(row.imap_port, 993),
    imapSecure: normalizeSqliteBoolean(row.imap_secure, true),
    imapUser: String(row.imap_user || ""),
    imapPass: String(row.imap_pass || ""),
    createdAt: String(row.created_at || nowIso()),
    updatedAt: String(row.updated_at || nowIso())
  };
}

function mapPlanRow(row) {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    description: String(row.description || ""),
    siteId: String(row.site_id || ""),
    profileId: String(row.profile_id || ""),
    mailConfigId: row.mail_config_id ? String(row.mail_config_id) : "",
    runMode: row.run_mode === "headed" ? "headed" : "headless",
    continueAfterProtectedChallenge: normalizeSqliteBoolean(
      row.continue_after_protected_challenge,
      false
    ),
    createdAt: String(row.created_at || nowIso()),
    updatedAt: String(row.updated_at || nowIso())
  };
}

function mapRunRow(row) {
  return toPublicRunRecord({
    id: row.id,
    taskId: row.task_id,
    caseId: row.case_id,
    planId: row.plan_id,
    planName: row.plan_name,
    siteId: row.site_id,
    siteName: row.site_name,
    profileId: row.profile_id,
    mailConfigId: row.mail_config_id,
    status: row.status,
    mode: row.mode,
    summary: row.summary,
    command: row.command,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    exitCode: row.exit_code,
    logs: parseStoredJson(row.logs_json, []),
    latestStage: parseStoredJson(row.latest_stage_json, null),
    insight: parseStoredJson(row.insight_json, null),
    conclusion: parseStoredJson(row.conclusion_json, null),
    artifactKeys: parseStoredJson(row.artifact_keys_json, []),
    reportAvailable: normalizeSqliteBoolean(row.report_available, false),
    pid: row.pid,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function mapTaskRow(row) {
  const normalized = normalizeTaskRecord({
    id: row.id,
    name: row.name,
    status: row.status,
    sourceKind: row.source_kind,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  return {
    ...normalized,
    sourcePath: normalized.sourceRef,
    startedAt: normalized.createdAt,
    finishedAt: "",
    runCount: parseNumber(row.run_count, 0),
    caseCount: parseNumber(row.case_count, 0),
    artifactCount: parseNumber(row.artifact_count, 0)
  };
}

function mapCaseRow(row) {
  const normalized = normalizeCaseRecord({
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    status: row.status,
    sourceKind: row.source_kind,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  return {
    ...normalized,
    runId: null,
    sourcePath: normalized.sourceRef,
    caseKey: normalized.name,
    title: normalized.name,
    retryIndex: parseRetryIndex(normalized.name),
    runCount: parseNumber(row.run_count, 0),
    artifactCount: parseNumber(row.artifact_count, 0)
  };
}

function mapArtifactRow(row) {
  const artifact = normalizeArtifactRecord({
    id: row.id,
    taskId: row.task_id,
    caseId: row.case_id,
    runId: row.run_id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    bucket: row.bucket,
    type: row.type,
    name: row.name,
    relPath: row.rel_path,
    contentType: row.content_type,
    storageKind: row.storage_kind,
    sizeBytes: row.size_bytes,
    modifiedAt: row.modified_at,
    sourcePath: row.source_path,
    contentBuffer: row.content_blob,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  return {
    id: artifact.id,
    bucket: artifact.bucket,
    type: artifact.type,
    name: artifact.name,
    relPath: artifact.relPath,
    absolutePath: artifact.sourcePath,
    modifiedAt: artifact.modifiedAt,
    sizeBytes: artifact.sizeBytes,
    href: buildArtifactHref(artifact.id, artifact.type, artifact.relPath),
    runId: artifact.runId || null,
    taskId: artifact.taskId || null,
    caseId: artifact.caseId || null,
    isSensitive: artifact.type === "token",
    contentType: artifact.contentType,
    storageKind: artifact.storageKind
  };
}

function getMailReadiness(mailConfig) {
  if (!mailConfig) {
    return {
      ready: false,
      label: "未配置",
      detail: "尚未关联邮箱配置。"
    };
  }

  if (!mailConfig.enabled) {
    return {
      ready: false,
      label: "已停用",
      detail: "当前邮箱配置处于停用状态。"
    };
  }

  if (mailConfig.mode === "temp-mail") {
    if (mailConfig.baseUrl && mailConfig.apiKey) {
      return {
        ready: true,
        label: "临时邮箱就绪",
        detail: "已配置 baseUrl 和 API Key。"
      };
    }

    return {
      ready: false,
      label: "临时邮箱缺少配置",
      detail: "需要 baseUrl 和 API Key。"
    };
  }

  if (mailConfig.imapHost && mailConfig.imapUser && mailConfig.imapPass) {
    return {
      ready: true,
      label: "IMAP 就绪",
      detail: "IMAP 连接参数已填写。"
    };
  }

  return {
    ready: false,
    label: "IMAP 缺少配置",
    detail: "需要 IMAP_HOST、IMAP_USER、IMAP_PASS。"
  };
}

function createSchemaSql() {
  return `
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      expected_outcomes_json TEXT NOT NULL,
      granted_permissions_json TEXT NOT NULL,
      selectors_json TEXT NOT NULL,
      email_verification_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mail_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL CHECK (mode IN ('temp-mail', 'imap')),
      enabled INTEGER NOT NULL DEFAULT 1,
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      imap_host TEXT NOT NULL DEFAULT '',
      imap_port INTEGER NOT NULL DEFAULT 993,
      imap_secure INTEGER NOT NULL DEFAULT 1,
      imap_user TEXT NOT NULL DEFAULT '',
      imap_pass TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      site_id TEXT NOT NULL REFERENCES sites(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      mail_config_id TEXT REFERENCES mail_configs(id),
      run_mode TEXT NOT NULL CHECK (run_mode IN ('headless', 'headed')),
      continue_after_protected_challenge INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS selection_state (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      selected_site_id TEXT NOT NULL DEFAULT '',
      selected_plan_id TEXT NOT NULL DEFAULT '',
      selected_profile_id TEXT NOT NULL DEFAULT '',
      selected_mail_config_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      default_run_mode TEXT NOT NULL CHECK (default_run_mode IN ('headless', 'headed')),
      continue_after_protected_challenge INTEGER NOT NULL DEFAULT 0,
      preferred_landing_page TEXT NOT NULL DEFAULT 'overview',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      source_kind TEXT NOT NULL DEFAULT 'synthetic',
      source_ref TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      source_kind TEXT NOT NULL DEFAULT 'synthetic',
      source_ref TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      case_id TEXT,
      plan_id TEXT NOT NULL DEFAULT '',
      plan_name TEXT NOT NULL DEFAULT '',
      site_id TEXT NOT NULL DEFAULT '',
      site_name TEXT NOT NULL DEFAULT '',
      profile_id TEXT NOT NULL DEFAULT '',
      mail_config_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      mode TEXT NOT NULL CHECK (mode IN ('headless', 'headed')),
      summary TEXT NOT NULL DEFAULT '',
      command TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT '',
      finished_at TEXT NOT NULL DEFAULT '',
      exit_code INTEGER,
      logs_json TEXT NOT NULL DEFAULT '[]',
      latest_stage_json TEXT,
      insight_json TEXT,
      conclusion_json TEXT,
      artifact_keys_json TEXT NOT NULL DEFAULT '[]',
      report_available INTEGER NOT NULL DEFAULT 0,
      pid INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      owner_type TEXT NOT NULL DEFAULT 'run',
      owner_id TEXT NOT NULL DEFAULT '',
      bucket TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      storage_kind TEXT NOT NULL DEFAULT 'blob',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      modified_at TEXT NOT NULL,
      source_path TEXT NOT NULL DEFAULT '',
      content_blob BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plans_site_id ON plans (site_id);
    CREATE INDEX IF NOT EXISTS idx_plans_profile_id ON plans (profile_id);
    CREATE INDEX IF NOT EXISTS idx_plans_mail_config_id ON plans (mail_config_id);
    CREATE INDEX IF NOT EXISTS idx_cases_task_id ON cases (task_id);
    CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs (started_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_plan_id ON runs (plan_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs (status);
    CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts (run_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts (task_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_case_id ON artifacts (case_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_bucket_rel_path ON artifacts (bucket, rel_path);
  `;
}

export function createPlatformStore(projectRoot) {
  const paths = {
    projectRoot,
    configPath: path.join(projectRoot, "config"),
    platformDatabasePath: path.join(projectRoot, "config", "platform.sqlite"),
    platformStatePath: path.join(projectRoot, "config", "platform-state.json"),
    legacyTargetSitePath: path.join(projectRoot, "config", "target-site.json"),
    legacyTempMailPath: path.join(projectRoot, "config", "temp-mail.json"),
    activeProfilePath: path.join(projectRoot, "config", "target-profile.json"),
    legacyRunHistoryPath: path.join(projectRoot, "artifacts", "platform", "run-history.json"),
    runtimeTaskRootPath: path.join(projectRoot, "runtime", "control-plane", "tasks"),
    artifactTaskRootPath: path.join(projectRoot, "artifacts", "tasks"),
    envPath: path.join(projectRoot, ".env")
  };

  let database = null;
  let databaseReadyPromise = null;

  async function readEnvText() {
    if (!existsSync(paths.envPath)) {
      return "";
    }

    return readFile(paths.envPath, "utf8");
  }

  async function readLegacyTargetSite() {
    return readJson(paths.legacyTargetSitePath, {
      startUrl: "",
      updatedAt: ""
    });
  }

  async function readLegacyTempMail() {
    return readJson(paths.legacyTempMailPath, {
      baseUrl: "",
      apiKey: "",
      updatedAt: ""
    });
  }

  async function readLegacyProfile() {
    return readJson(paths.activeProfilePath, getDefaultProfileConfig());
  }

  async function readLegacyPlatformState() {
    return readJson(paths.platformStatePath, {});
  }

  async function readLegacyRunHistory() {
    return readJson(paths.legacyRunHistoryPath, []);
  }

  async function readLegacyTaskDirectoryState() {
    const taskRoots = [
      { rootPath: paths.runtimeTaskRootPath, sourceKind: "runtime-task-dir" },
      { rootPath: paths.artifactTaskRootPath, sourceKind: "artifact-task-dir" }
    ];
    const tasks = [];
    const cases = [];

    for (const source of taskRoots) {
      if (!existsSync(source.rootPath)) {
        continue;
      }

      const taskEntries = await readdir(source.rootPath, { withFileTypes: true });
      for (const taskEntry of taskEntries) {
        if (!taskEntry.isDirectory()) {
          continue;
        }

        const taskId = String(taskEntry.name);
        const taskPath = path.join(source.rootPath, taskEntry.name);
        const taskChildren = await readdir(taskPath, { withFileTypes: true });
        const taskRef = path.relative(projectRoot, path.join(source.rootPath, taskEntry.name));
        const casesPath = path.join(taskPath, "cases");
        if (!existsSync(casesPath)) {
          if (!taskChildren.some((entry) => !entry.isDirectory())) {
            continue;
          }
          tasks.push(
            normalizeTaskRecord({
              id: taskId,
              name: taskId,
              status: "imported",
              sourceKind: source.sourceKind,
              sourceRef: taskRef
            })
          );
          continue;
        }

        const caseEntries = await readdir(casesPath, { withFileTypes: true });
        const directoryCases = caseEntries.filter((entry) => entry.isDirectory());
        const hasStandaloneFiles = taskChildren.some(
          (entry) => !entry.isDirectory() || entry.name !== "cases"
        );

        if (!directoryCases.length && !hasStandaloneFiles) {
          continue;
        }

        tasks.push(
          normalizeTaskRecord({
            id: taskId,
            name: taskId,
            status: "imported",
            sourceKind: source.sourceKind,
            sourceRef: taskRef
          })
        );

        if (!directoryCases.length) {
          cases.push(
            normalizeCaseRecord({
              id: `${taskId}:default`,
              taskId,
              name: "default",
              status: "imported",
              sourceKind: `${source.sourceKind}-default-case`,
              sourceRef: path.relative(projectRoot, casesPath)
            })
          );
          continue;
        }

        for (const caseEntry of directoryCases) {
          cases.push(
            normalizeCaseRecord({
              id: `${taskId}:${caseEntry.name}`,
              taskId,
              name: caseEntry.name,
              status: "imported",
              sourceKind: `${source.sourceKind}-case`,
              sourceRef: path.relative(projectRoot, path.join(casesPath, caseEntry.name))
            })
          );
        }
      }
    }

    return {
      tasks,
      cases
    };
  }

  async function buildBootstrapStateFromLegacyFiles() {
    const legacyTarget = await readLegacyTargetSite();
    const legacyMail = await readLegacyTempMail();
    const legacyProfile = await readLegacyProfile();
    const envText = await readEnvText();
    const siteId = createId("site");
    const profileId = createId("profile");
    const mailConfigId = createId("mail");
    const planId = createId("plan");
    const currentTime = nowIso();
    const useTempMail = /USE_TEMP_MAIL=(true|1|yes)/i.test(envText);
    const envValues = {
      tempMailBaseUrl: readEnvValue(envText, "TEMP_MAIL_BASE_URL"),
      tempMailApiKey: readEnvValue(envText, "TEMP_MAIL_API_KEY"),
      imapHost: readEnvValue(envText, "IMAP_HOST"),
      imapPort: readEnvValue(envText, "IMAP_PORT"),
      imapSecure: readEnvValue(envText, "IMAP_SECURE"),
      imapUser: readEnvValue(envText, "IMAP_USER"),
      imapPass: readEnvValue(envText, "IMAP_PASS"),
      headed: readEnvValue(envText, "HEADED"),
      continueAfterProtectedChallenge: readEnvValue(
        envText,
        "CONTINUE_AFTER_PROTECTED_CHALLENGE"
      )
    };

    return {
      version: 2,
      selectedSiteId: siteId,
      selectedPlanId: planId,
      selectedProfileId: profileId,
      selectedMailConfigId: mailConfigId,
      sites: [
        {
          id: siteId,
          name: "默认目标站点",
          description: "已从旧版 target-site.json 自动引导生成。",
          startUrl: legacyTarget.startUrl ? validateHttpsUrl(legacyTarget.startUrl) : "",
          status: legacyTarget.startUrl ? "ready" : "draft",
          createdAt: currentTime,
          updatedAt: currentTime
        }
      ],
      profiles: [
        {
          id: profileId,
          ...legacyProfile,
          createdAt: currentTime,
          updatedAt: currentTime
        }
      ],
      mailConfigs: [
        {
          id: mailConfigId,
          name: "默认邮箱配置",
          description: "已从旧版 temp-mail.json 和 .env 自动引导生成。",
          mode: useTempMail ? "temp-mail" : "imap",
          enabled: Boolean(legacyMail.baseUrl || envValues.imapHost),
          baseUrl: legacyMail.baseUrl || envValues.tempMailBaseUrl || "",
          apiKey: legacyMail.apiKey || envValues.tempMailApiKey || "",
          imapHost: envValues.imapHost || "",
          imapPort: parseNumber(envValues.imapPort, 993),
          imapSecure: parseBoolean(envValues.imapSecure, true),
          imapUser: envValues.imapUser || "",
          imapPass: envValues.imapPass || "",
          createdAt: currentTime,
          updatedAt: currentTime
        }
      ],
      plans: [
        {
          id: planId,
          name: "默认注册方案",
          description: "已从旧版单站点配置自动引导生成。",
          siteId,
          profileId,
          mailConfigId,
          runMode: parseBoolean(envValues.headed, false) ? "headed" : "headless",
          continueAfterProtectedChallenge: parseBoolean(
            envValues.continueAfterProtectedChallenge,
            false
          ),
          createdAt: currentTime,
          updatedAt: currentTime
        }
      ],
      system: {
        defaultRunMode: parseBoolean(envValues.headed, false) ? "headed" : "headless",
        continueAfterProtectedChallenge: parseBoolean(
          envValues.continueAfterProtectedChallenge,
          false
        ),
        preferredLandingPage: "overview",
        notes: "",
        updatedAt: currentTime
      },
      updatedAt: currentTime
    };
  }

  async function loadBootstrapState() {
    if (existsSync(paths.platformStatePath)) {
      const legacyPlatformState = await readLegacyPlatformState();

      try {
        return normalizeState(legacyPlatformState);
      } catch {
        // Fall through to the single-file bootstrap path.
      }
    }

    return normalizeState(await buildBootstrapStateFromLegacyFiles());
  }

  function writeStateToDatabase(connection, nextState) {
    const normalizedState = normalizeState(nextState);
    const upsertSelection = connection.prepare(`
      INSERT INTO selection_state (
        singleton,
        selected_site_id,
        selected_plan_id,
        selected_profile_id,
        selected_mail_config_id,
        updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        selected_site_id = excluded.selected_site_id,
        selected_plan_id = excluded.selected_plan_id,
        selected_profile_id = excluded.selected_profile_id,
        selected_mail_config_id = excluded.selected_mail_config_id,
        updated_at = excluded.updated_at
    `);
    const upsertSystem = connection.prepare(`
      INSERT INTO system_settings (
        singleton,
        default_run_mode,
        continue_after_protected_challenge,
        preferred_landing_page,
        notes,
        updated_at
      ) VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        default_run_mode = excluded.default_run_mode,
        continue_after_protected_challenge = excluded.continue_after_protected_challenge,
        preferred_landing_page = excluded.preferred_landing_page,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);
    const insertSite = connection.prepare(`
      INSERT INTO sites (
        id,
        name,
        description,
        start_url,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertProfile = connection.prepare(`
      INSERT INTO profiles (
        id,
        name,
        description,
        expected_outcomes_json,
        granted_permissions_json,
        selectors_json,
        email_verification_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMailConfig = connection.prepare(`
      INSERT INTO mail_configs (
        id,
        name,
        description,
        mode,
        enabled,
        base_url,
        api_key,
        imap_host,
        imap_port,
        imap_secure,
        imap_user,
        imap_pass,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPlan = connection.prepare(`
      INSERT INTO plans (
        id,
        name,
        description,
        site_id,
        profile_id,
        mail_config_id,
        run_mode,
        continue_after_protected_challenge,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      connection.exec("BEGIN IMMEDIATE");
      connection.exec(`
        DELETE FROM plans;
        DELETE FROM sites;
        DELETE FROM profiles;
        DELETE FROM mail_configs;
      `);

      for (const site of normalizedState.sites) {
        insertSite.run(
          site.id,
          site.name,
          site.description,
          site.startUrl,
          site.status,
          site.createdAt,
          site.updatedAt
        );
      }

      for (const profile of normalizedState.profiles) {
        insertProfile.run(
          profile.id,
          profile.name,
          profile.description,
          serializeJson(profile.expectedOutcomes),
          serializeJson(profile.grantedPermissions),
          serializeJson(profile.selectors),
          serializeJson(profile.emailVerification),
          profile.createdAt,
          profile.updatedAt
        );
      }

      for (const mailConfig of normalizedState.mailConfigs) {
        insertMailConfig.run(
          mailConfig.id,
          mailConfig.name,
          mailConfig.description,
          mailConfig.mode,
          sqliteBoolean(mailConfig.enabled),
          mailConfig.baseUrl,
          mailConfig.apiKey,
          mailConfig.imapHost,
          mailConfig.imapPort,
          sqliteBoolean(mailConfig.imapSecure),
          mailConfig.imapUser,
          mailConfig.imapPass,
          mailConfig.createdAt,
          mailConfig.updatedAt
        );
      }

      for (const plan of normalizedState.plans) {
        insertPlan.run(
          plan.id,
          plan.name,
          plan.description,
          plan.siteId,
          plan.profileId,
          plan.mailConfigId || null,
          plan.runMode,
          sqliteBoolean(plan.continueAfterProtectedChallenge),
          plan.createdAt,
          plan.updatedAt
        );
      }

      upsertSelection.run(
        normalizedState.selectedSiteId,
        normalizedState.selectedPlanId,
        normalizedState.selectedProfileId,
        normalizedState.selectedMailConfigId,
        normalizedState.updatedAt
      );
      upsertSystem.run(
        normalizedState.system.defaultRunMode,
        sqliteBoolean(normalizedState.system.continueAfterProtectedChallenge),
        normalizedState.system.preferredLandingPage,
        normalizedState.system.notes,
        normalizedState.system.updatedAt || normalizedState.updatedAt
      );
      connection.exec("COMMIT");
    } catch (error) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures after the original error.
      }
      throw error;
    }
  }

  function countCoreRecords(connection) {
    return {
      sites: Number(connection.prepare("SELECT COUNT(*) AS count FROM sites").get().count || 0),
      profiles: Number(connection.prepare("SELECT COUNT(*) AS count FROM profiles").get().count || 0),
      mailConfigs: Number(
        connection.prepare("SELECT COUNT(*) AS count FROM mail_configs").get().count || 0
      ),
      plans: Number(connection.prepare("SELECT COUNT(*) AS count FROM plans").get().count || 0)
    };
  }

  function ensureColumnExists(connection, tableName, columnName, columnSql) {
    const columns = connection.prepare(`PRAGMA table_info(${tableName})`).all();
    const hasColumn = columns.some((column) => String(column.name) === columnName);
    if (!hasColumn) {
      connection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
    }
  }

  function ensureSchemaMigrations(connection) {
    ensureColumnExists(connection, "runs", "task_id", "task_id TEXT");
    ensureColumnExists(connection, "runs", "case_id", "case_id TEXT");
    connection.exec("CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs (task_id)");
    connection.exec("CREATE INDEX IF NOT EXISTS idx_runs_case_id ON runs (case_id)");
  }

  function countRunRecords(connection) {
    return Number(connection.prepare("SELECT COUNT(*) AS count FROM runs").get().count || 0);
  }

  function countTaskRecords(connection) {
    return Number(connection.prepare("SELECT COUNT(*) AS count FROM tasks").get().count || 0);
  }

  function countCaseRecords(connection) {
    return Number(connection.prepare("SELECT COUNT(*) AS count FROM cases").get().count || 0);
  }

  function countArtifactRecords(connection) {
    return Number(connection.prepare("SELECT COUNT(*) AS count FROM artifacts").get().count || 0);
  }

  function writeTaskToDatabase(connection, taskRecord) {
    const normalizedTask = normalizeTaskRecord(taskRecord);
    connection.prepare(`
      INSERT INTO tasks (
        id,
        name,
        status,
        source_kind,
        source_ref,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        status = excluded.status,
        source_kind = excluded.source_kind,
        source_ref = excluded.source_ref,
        updated_at = excluded.updated_at
    `).run(
      normalizedTask.id,
      normalizedTask.name,
      normalizedTask.status,
      normalizedTask.sourceKind,
      normalizedTask.sourceRef,
      normalizedTask.createdAt,
      normalizedTask.updatedAt
    );

    return normalizedTask;
  }

  function writeCaseToDatabase(connection, caseRecord) {
    const normalizedCase = normalizeCaseRecord(caseRecord);
    if (!normalizedCase.taskId) {
      throw new Error("Case 必须关联 taskId。");
    }

    connection.prepare(`
      INSERT INTO cases (
        id,
        task_id,
        name,
        status,
        source_kind,
        source_ref,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        name = excluded.name,
        status = excluded.status,
        source_kind = excluded.source_kind,
        source_ref = excluded.source_ref,
        updated_at = excluded.updated_at
    `).run(
      normalizedCase.id,
      normalizedCase.taskId,
      normalizedCase.name,
      normalizedCase.status,
      normalizedCase.sourceKind,
      normalizedCase.sourceRef,
      normalizedCase.createdAt,
      normalizedCase.updatedAt
    );

    return normalizedCase;
  }

  function ensureTaskAndCaseForRun(connection, normalizedRun) {
    const task = writeTaskToDatabase(connection, {
      id: normalizedRun.taskId || `task-${normalizedRun.id}`,
      name: normalizedRun.planName || normalizedRun.id,
      status: normalizedRun.status,
      sourceKind: normalizedRun.taskId ? "linked-run" : "synthetic-run",
      sourceRef: normalizedRun.id,
      createdAt: normalizedRun.createdAt,
      updatedAt: normalizedRun.updatedAt
    });
    const linkedCase = writeCaseToDatabase(connection, {
      id: normalizedRun.caseId || `case-${normalizedRun.id}`,
      taskId: task.id,
      name: "default",
      status: normalizedRun.status,
      sourceKind: normalizedRun.caseId ? "linked-run" : "synthetic-run",
      sourceRef: normalizedRun.id,
      createdAt: normalizedRun.createdAt,
      updatedAt: normalizedRun.updatedAt
    });

    normalizedRun.taskId = task.id;
    normalizedRun.caseId = linkedCase.id;
    return normalizedRun;
  }

  function writeRunToDatabase(connection, runRecord) {
    const normalizedRun = ensureTaskAndCaseForRun(connection, normalizeRunRecord(runRecord));
    connection.prepare(`
      INSERT INTO runs (
        id,
        task_id,
        case_id,
        plan_id,
        plan_name,
        site_id,
        site_name,
        profile_id,
        mail_config_id,
        status,
        mode,
        summary,
        command,
        started_at,
        finished_at,
        exit_code,
        logs_json,
        latest_stage_json,
        insight_json,
        conclusion_json,
        artifact_keys_json,
        report_available,
        pid,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        case_id = excluded.case_id,
        plan_id = excluded.plan_id,
        plan_name = excluded.plan_name,
        site_id = excluded.site_id,
        site_name = excluded.site_name,
        profile_id = excluded.profile_id,
        mail_config_id = excluded.mail_config_id,
        status = excluded.status,
        mode = excluded.mode,
        summary = excluded.summary,
        command = excluded.command,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        exit_code = excluded.exit_code,
        logs_json = excluded.logs_json,
        latest_stage_json = excluded.latest_stage_json,
        insight_json = excluded.insight_json,
        conclusion_json = excluded.conclusion_json,
        artifact_keys_json = excluded.artifact_keys_json,
        report_available = excluded.report_available,
        pid = excluded.pid,
        updated_at = excluded.updated_at
    `).run(
      normalizedRun.id,
      normalizedRun.taskId,
      normalizedRun.caseId,
      normalizedRun.planId,
      normalizedRun.planName,
      normalizedRun.siteId,
      normalizedRun.siteName,
      normalizedRun.profileId,
      normalizedRun.mailConfigId,
      normalizedRun.status,
      normalizedRun.mode,
      normalizedRun.summary,
      normalizedRun.command,
      normalizedRun.startedAt,
      normalizedRun.finishedAt,
      normalizedRun.exitCode,
      serializeJson(normalizedRun.logs),
      serializeJson(normalizedRun.latestStage),
      serializeJson(normalizedRun.insight),
      serializeJson(normalizedRun.conclusion),
      serializeJson(normalizedRun.artifactKeys),
      sqliteBoolean(normalizedRun.reportAvailable),
      normalizedRun.pid,
      normalizedRun.createdAt,
      normalizedRun.updatedAt
    );

    return toPublicRunRecord(normalizedRun);
  }

  function writeArtifactToDatabase(connection, artifactRecord) {
    const normalizedArtifact = normalizeArtifactRecord(artifactRecord);
    connection.prepare(`
      INSERT INTO artifacts (
        id,
        task_id,
        case_id,
        run_id,
        owner_type,
        owner_id,
        bucket,
        type,
        name,
        rel_path,
        content_type,
        storage_kind,
        size_bytes,
        modified_at,
        source_path,
        content_blob,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        case_id = excluded.case_id,
        run_id = excluded.run_id,
        owner_type = excluded.owner_type,
        owner_id = excluded.owner_id,
        bucket = excluded.bucket,
        type = excluded.type,
        name = excluded.name,
        rel_path = excluded.rel_path,
        content_type = excluded.content_type,
        storage_kind = excluded.storage_kind,
        size_bytes = excluded.size_bytes,
        modified_at = excluded.modified_at,
        source_path = excluded.source_path,
        content_blob = excluded.content_blob,
        updated_at = excluded.updated_at
    `).run(
      normalizedArtifact.id,
      normalizedArtifact.taskId || null,
      normalizedArtifact.caseId || null,
      normalizedArtifact.runId || null,
      normalizedArtifact.ownerType,
      normalizedArtifact.ownerId,
      normalizedArtifact.bucket,
      normalizedArtifact.type,
      normalizedArtifact.name,
      normalizedArtifact.relPath,
      normalizedArtifact.contentType,
      normalizedArtifact.storageKind,
      normalizedArtifact.sizeBytes,
      normalizedArtifact.modifiedAt,
      normalizedArtifact.sourcePath,
      normalizedArtifact.contentBuffer,
      normalizedArtifact.createdAt,
      normalizedArtifact.updatedAt
    );

    return mapArtifactRow({
      id: normalizedArtifact.id,
      task_id: normalizedArtifact.taskId,
      case_id: normalizedArtifact.caseId,
      run_id: normalizedArtifact.runId,
      owner_type: normalizedArtifact.ownerType,
      owner_id: normalizedArtifact.ownerId,
      bucket: normalizedArtifact.bucket,
      type: normalizedArtifact.type,
      name: normalizedArtifact.name,
      rel_path: normalizedArtifact.relPath,
      content_type: normalizedArtifact.contentType,
      storage_kind: normalizedArtifact.storageKind,
      size_bytes: normalizedArtifact.sizeBytes,
      modified_at: normalizedArtifact.modifiedAt,
      source_path: normalizedArtifact.sourcePath,
      content_blob: normalizedArtifact.contentBuffer,
      created_at: normalizedArtifact.createdAt,
      updated_at: normalizedArtifact.updatedAt
    });
  }

  async function importLegacyRunHistory(connection) {
    const legacyRuns = await readLegacyRunHistory();
    if (!Array.isArray(legacyRuns) || !legacyRuns.length) {
      return 0;
    }

    try {
      connection.exec("BEGIN IMMEDIATE");
      for (const runRecord of legacyRuns) {
        writeRunToDatabase(connection, runRecord);
      }
      connection.exec("COMMIT");
      return legacyRuns.length;
    } catch (error) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures after the original error.
      }
      throw error;
    }
  }

  async function importLegacyTasksAndCases(connection) {
    const legacyState = await readLegacyTaskDirectoryState();
    if (!legacyState.tasks.length && !legacyState.cases.length) {
      return { taskCount: 0, caseCount: 0 };
    }

    try {
      connection.exec("BEGIN IMMEDIATE");
      for (const taskRecord of legacyState.tasks) {
        writeTaskToDatabase(connection, taskRecord);
      }
      for (const caseRecord of legacyState.cases) {
        writeCaseToDatabase(connection, caseRecord);
      }
      connection.exec("COMMIT");
      return {
        taskCount: legacyState.tasks.length,
        caseCount: legacyState.cases.length
      };
    } catch (error) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures after the original error.
      }
      throw error;
    }
  }

  function buildStoredRunArtifactMap(connection) {
    const runs = connection
      .prepare("SELECT * FROM runs ORDER BY datetime(started_at) DESC, id DESC")
      .all()
      .map(mapRunRow);
    const artifactMap = new Map();

    for (const run of runs) {
      for (const artifactKey of run.artifactKeys || []) {
        artifactMap.set(artifactKey, {
          runId: run.id,
          taskId: run.taskId || "",
          caseId: run.caseId || ""
        });
      }
    }

    return artifactMap;
  }

  async function archiveArtifactsToDatabase(connection, options = {}) {
    const artifactKeys =
      Array.isArray(options.artifactKeys) && options.artifactKeys.length
        ? new Set(options.artifactKeys.map((entry) => String(entry)))
        : null;
    const explicitRunId = String(options.runId || "").trim();
    const explicitTaskId = String(options.taskId || "").trim();
    const explicitCaseId = String(options.caseId || "").trim();
    const entries = await scanArtifactEntries(projectRoot);
    const ownershipMap = buildStoredRunArtifactMap(connection);
    const targets = artifactKeys
      ? entries.filter((entry) => artifactKeys.has(String(entry.id || "")))
      : entries;

    try {
      connection.exec("BEGIN IMMEDIATE");
      for (const entry of targets) {
        const ownership = explicitRunId
          ? {
              runId: explicitRunId,
              taskId: explicitTaskId,
              caseId: explicitCaseId
            }
          : (ownershipMap.get(String(entry.id || "")) || {
              runId: "",
              taskId: "",
              caseId: ""
            });

        const contentBuffer = await readFile(entry.absolutePath);
        writeArtifactToDatabase(connection, {
          id: entry.id,
          taskId: ownership.taskId,
          caseId: ownership.caseId,
          runId: ownership.runId,
          ownerType: ownership.runId ? "run" : ownership.caseId ? "case" : ownership.taskId ? "task" : "run",
          ownerId: ownership.runId || ownership.caseId || ownership.taskId || "",
          bucket: entry.bucket,
          type: entry.type,
          name: entry.name,
          relPath: entry.relPath,
          contentType: getArtifactContentType(entry.relPath),
          storageKind: getArtifactStorageKind(entry.relPath),
          sizeBytes: entry.sizeBytes,
          modifiedAt: entry.modifiedAt,
          sourcePath: entry.absolutePath,
          contentBuffer
        });
      }
      connection.exec("COMMIT");
      return targets.length;
    } catch (error) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures after the original error.
      }
      throw error;
    }
  }

  function backfillRunOwnership(connection) {
    const runs = connection.prepare("SELECT * FROM runs ORDER BY datetime(started_at) ASC, id ASC").all();
    if (!runs.length) {
      return 0;
    }

    let updated = 0;
    try {
      connection.exec("BEGIN IMMEDIATE");
      for (const row of runs) {
        if (row.task_id && row.case_id) {
          continue;
        }
        writeRunToDatabase(connection, mapRunRow(row));
        updated += 1;
      }
      connection.exec("COMMIT");
      return updated;
    } catch (error) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures after the original error.
      }
      throw error;
    }
  }

  async function getDatabase() {
    if (database) {
      return database;
    }

    if (databaseReadyPromise) {
      await databaseReadyPromise;
      return database;
    }

    databaseReadyPromise = (async () => {
      await ensureParentDirectory(paths.platformDatabasePath);
      database = new DatabaseSync(paths.platformDatabasePath);
      database.exec(createSchemaSql());
      ensureSchemaMigrations(database);

      const counts = countCoreRecords(database);
      if (!counts.sites || !counts.profiles || !counts.mailConfigs || !counts.plans) {
        const bootstrapState = await loadBootstrapState();
        assertSafeConfig(bootstrapState);
        writeStateToDatabase(database, bootstrapState);
      }

      if (!countRunRecords(database)) {
        await importLegacyRunHistory(database);
      }

      if (!countTaskRecords(database) || !countCaseRecords(database)) {
        await importLegacyTasksAndCases(database);
      }

      backfillRunOwnership(database);

    const scannedArtifacts = await scanArtifactEntries(projectRoot);
    if (countArtifactRecords(database) !== scannedArtifacts.length) {
      await archiveArtifactsToDatabase(database);
    }
    })();

    try {
      await databaseReadyPromise;
      return database;
    } finally {
      databaseReadyPromise = null;
    }
  }

  function readStateFromDatabase(connection) {
    const selectionRow =
      connection.prepare("SELECT * FROM selection_state WHERE singleton = 1").get() || {};
    const systemRow =
      connection.prepare("SELECT * FROM system_settings WHERE singleton = 1").get() || {};
    const rawState = {
      version: 2,
      selectedSiteId: selectionRow.selected_site_id || "",
      selectedPlanId: selectionRow.selected_plan_id || "",
      selectedProfileId: selectionRow.selected_profile_id || "",
      selectedMailConfigId: selectionRow.selected_mail_config_id || "",
      sites: connection
        .prepare("SELECT * FROM sites ORDER BY datetime(created_at) ASC, id ASC")
        .all()
        .map(mapSiteRow),
      profiles: connection
        .prepare("SELECT * FROM profiles ORDER BY datetime(created_at) ASC, id ASC")
        .all()
        .map(mapProfileRow),
      mailConfigs: connection
        .prepare("SELECT * FROM mail_configs ORDER BY datetime(created_at) ASC, id ASC")
        .all()
        .map(mapMailConfigRow),
      plans: connection
        .prepare("SELECT * FROM plans ORDER BY datetime(created_at) ASC, id ASC")
        .all()
        .map(mapPlanRow),
      system: {
        ...getDefaultSystemState(),
        defaultRunMode:
          systemRow.default_run_mode === "headed" ? "headed" : "headless",
        continueAfterProtectedChallenge: normalizeSqliteBoolean(
          systemRow.continue_after_protected_challenge,
          false
        ),
        preferredLandingPage: String(systemRow.preferred_landing_page || "overview"),
        notes: String(systemRow.notes || ""),
        updatedAt: String(
          systemRow.updated_at ||
            selectionRow.updated_at ||
            nowIso()
        )
      },
      updatedAt: String(
        selectionRow.updated_at ||
          systemRow.updated_at ||
          nowIso()
      )
    };

    return normalizeState(rawState);
  }

  async function persistState(nextState) {
    const connection = await getDatabase();
    const normalizedState = normalizeState(nextState);
    normalizedState.updatedAt = nowIso();
    normalizedState.system.updatedAt =
      normalizedState.system.updatedAt || normalizedState.updatedAt;
    assertSafeConfig(normalizedState);
    writeStateToDatabase(connection, normalizedState);
    return normalizedState;
  }

  async function readState() {
    const connection = await getDatabase();
    return readStateFromDatabase(connection);
  }

  async function writeState(nextState) {
    return persistState(nextState);
  }

  async function listRuns() {
    const connection = await getDatabase();
    return connection
      .prepare("SELECT * FROM runs ORDER BY datetime(started_at) DESC, id DESC")
      .all()
      .map(mapRunRow);
  }

  async function getRunById(runId) {
    const connection = await getDatabase();
    const row = connection.prepare("SELECT * FROM runs WHERE id = ?").get(String(runId || ""));
    return row ? mapRunRow(row) : null;
  }

  async function saveRun(runRecord) {
    const connection = await getDatabase();
    return writeRunToDatabase(connection, {
      ...runRecord,
      updatedAt: nowIso()
    });
  }

  async function listTasks() {
    const connection = await getDatabase();
    const tasks = connection.prepare(`
      SELECT
        tasks.*,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id) AS case_count,
        (SELECT COUNT(*) FROM runs WHERE runs.task_id = tasks.id) AS run_count,
        (SELECT COUNT(*) FROM artifacts WHERE artifacts.task_id = tasks.id) AS artifact_count,
        (SELECT plan_id FROM runs WHERE runs.task_id = tasks.id ORDER BY datetime(started_at) DESC, id DESC LIMIT 1) AS plan_id,
        (SELECT plan_name FROM runs WHERE runs.task_id = tasks.id ORDER BY datetime(started_at) DESC, id DESC LIMIT 1) AS plan_name,
        (SELECT site_name FROM runs WHERE runs.task_id = tasks.id ORDER BY datetime(started_at) DESC, id DESC LIMIT 1) AS site_name,
        (SELECT mode FROM runs WHERE runs.task_id = tasks.id ORDER BY datetime(started_at) DESC, id DESC LIMIT 1) AS run_mode,
        (SELECT MIN(started_at) FROM runs WHERE runs.task_id = tasks.id) AS started_at,
        (SELECT MAX(finished_at) FROM runs WHERE runs.task_id = tasks.id AND finished_at != '') AS finished_at,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id AND cases.status IN ('success', 'passed', 'completed', 'failed', 'stopped')) AS completed_cases,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id AND cases.status IN ('success', 'passed', 'completed')) AS success_cases,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id AND cases.status = 'failed') AS failed_cases
      FROM tasks
      ORDER BY datetime(COALESCE((SELECT MAX(started_at) FROM runs WHERE runs.task_id = tasks.id), tasks.updated_at)) DESC, tasks.id DESC
    `).all().map((row) => {
      const base = mapTaskRow(row);
      const taskRuns = connection.prepare(`
        SELECT *
        FROM runs
        WHERE task_id = ?
        ORDER BY datetime(started_at) ASC, id ASC
      `).all(base.id).map(mapRunRow);
      const derivedCases = taskRuns.flatMap((runRecord) =>
        buildDerivedRepeatCasesFromRun(runRecord, base.id)
      );
      const useDerivedCases = derivedCases.length > parseNumber(row.case_count, 0);
      const completedCases = useDerivedCases
        ? derivedCases.filter((caseRecord) =>
            ["success", "failed", "stopped"].includes(String(caseRecord.status))
          ).length
        : parseNumber(row.completed_cases, 0);
      const successCases = useDerivedCases
        ? derivedCases.filter((caseRecord) => caseRecord.status === "success").length
        : parseNumber(row.success_cases, 0);
      const failedCases = useDerivedCases
        ? derivedCases.filter((caseRecord) => caseRecord.status === "failed").length
        : parseNumber(row.failed_cases, 0);
      // 优先使用活跃 run 的状态
      const activeRun = taskRuns.find((run) => run.status === "running" || run.status === "stopping");
      const derivedTaskStatus = activeRun
        ? activeRun.status
        : useDerivedCases
          ? derivedCases.some((caseRecord) => caseRecord.status === "running")
            ? "running"
            : derivedCases.some((caseRecord) => caseRecord.status === "failed")
              ? "failed"
              : derivedCases.some((caseRecord) => caseRecord.status === "stopped")
                ? "stopped"
                : derivedCases.length > 0 && derivedCases.every((caseRecord) => caseRecord.status === "success")
                  ? "completed"
                  : "pending"
          : base.status;

      return {
        ...base,
        status: derivedTaskStatus,
        planId: String(row.plan_id || ""),
        planName: String(row.plan_name || base.name),
        siteName: String(row.site_name || ""),
        runMode: row.run_mode === "headed" ? "headed" : "headless",
        startedAt: String(row.started_at || base.createdAt),
        finishedAt: String(row.finished_at || ""),
        totalCases: useDerivedCases ? derivedCases.length : parseNumber(row.case_count, 0),
        completedCases,
        successCases,
        failedCases
      };
    });
    return tasks;
  }

  async function listCases(filter = {}) {
    const connection = await getDatabase();
    const clauses = [];
    const values = [];

    if (filter.taskId) {
      clauses.push("cases.task_id = ?");
      values.push(String(filter.taskId));
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const cases = connection.prepare(`
      SELECT
        cases.*,
        (SELECT COUNT(*) FROM runs WHERE runs.case_id = cases.id) AS run_count,
        (SELECT COUNT(*) FROM artifacts WHERE artifacts.case_id = cases.id) AS artifact_count,
        (SELECT MIN(started_at) FROM runs WHERE runs.case_id = cases.id) AS started_at,
        (SELECT MAX(finished_at) FROM runs WHERE runs.case_id = cases.id AND finished_at != '') AS finished_at,
        (SELECT exit_code FROM runs WHERE runs.case_id = cases.id ORDER BY datetime(started_at) DESC LIMIT 1) AS exit_code,
        (SELECT latest_stage_json FROM runs WHERE runs.case_id = cases.id ORDER BY datetime(started_at) DESC LIMIT 1) AS latest_stage_json
      FROM cases
      ${whereSql}
      ORDER BY datetime(cases.created_at) ASC, cases.id ASC
    `).all(...values).map((row) => {
      const base = mapCaseRow(row);
      const caseNameMatch = String(row.name || "").match(/^case-(\d+)(?:-retry(\d+))?$/);
      const sequence = caseNameMatch ? Number(caseNameMatch[1]) : 0;
      const retryCount = caseNameMatch && caseNameMatch[2] ? Number(caseNameMatch[2]) : 0;

      return {
        ...base,
        sequence: sequence || base.retryIndex + 1,
        startedAt: String(row.started_at || ""),
        finishedAt: String(row.finished_at || ""),
        retryCount,
        maxRetries: 3,
        exitCode: parseNumber(row.exit_code, null),
        errorType: base.status === "failed" ? "unknown" : undefined,
        errorMessage: base.status === "failed" ? "执行失败" : undefined,
        errorStack: undefined,
        latestStage: parseStoredJson(row.latest_stage_json, null),
        runs: []
      };
    });

    // 为每个 case 加载关联的 runs
    for (const caseRecord of cases) {
      const runs = connection.prepare(`
        SELECT *
        FROM runs
        WHERE case_id = ?
        ORDER BY datetime(started_at) DESC
      `).all(caseRecord.id).map(mapRunRow);
      caseRecord.runs = runs;
    }

    if (!filter.taskId) {
      return cases;
    }

    const expandedCases = [];

    for (const caseRecord of cases) {
      const derivedCases =
        caseRecord.runs.length === 1
          ? buildDerivedRepeatCasesFromRun(caseRecord.runs[0], caseRecord.taskId)
          : [];

      if (derivedCases.length > 1) {
        expandedCases.push(...derivedCases);
        continue;
      }

      expandedCases.push(caseRecord);
    }

    return expandedCases.sort((left, right) => {
      const leftSequence = Number(left.sequence || 0);
      const rightSequence = Number(right.sequence || 0);
      if (leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }

      return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
    });
  }

  async function listArtifacts(filter = {}) {
    const connection = await getDatabase();
    const clauses = [];
    const values = [];

    if (filter.runId) {
      clauses.push("run_id = ?");
      values.push(String(filter.runId));
    }

    if (filter.taskId) {
      clauses.push("task_id = ?");
      values.push(String(filter.taskId));
    }

    if (filter.caseId) {
      clauses.push("case_id = ?");
      values.push(String(filter.caseId));
    }

    if (filter.type) {
      clauses.push("(type = ? OR bucket = ?)");
      values.push(String(filter.type), String(filter.type));
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return connection.prepare(`
      SELECT *
      FROM artifacts
      ${whereSql}
      ORDER BY datetime(modified_at) DESC, id DESC
    `).all(...values).map(mapArtifactRow);
  }

  async function archiveArtifactsForRun(options = {}) {
    const connection = await getDatabase();
    return archiveArtifactsToDatabase(connection, options);
  }

  async function getArtifactContent(bucket, relPath) {
    const connection = await getDatabase();
    const row = connection.prepare(`
      SELECT *
      FROM artifacts
      WHERE bucket = ? AND rel_path = ?
      LIMIT 1
    `).get(String(bucket || ""), String(relPath || ""));

    if (!row) {
      return null;
    }

    return {
      ...mapArtifactRow(row),
      contentBuffer: row.content_blob
    };
  }

  async function getArtifactById(artifactId) {
    const connection = await getDatabase();
    const row = connection.prepare(`
      SELECT *
      FROM artifacts
      WHERE id = ?
      LIMIT 1
    `).get(String(artifactId || ""));

    if (!row) {
      return null;
    }

    return {
      ...mapArtifactRow(row),
      contentBuffer: row.content_blob
    };
  }

  async function buildTaskDownloadBundle(taskId) {
    const connection = await getDatabase();
    const normalizedTaskId = String(taskId || "").trim();
    const taskRow = connection.prepare(`
      SELECT
        tasks.*,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id) AS case_count,
        (SELECT COUNT(*) FROM runs WHERE runs.task_id = tasks.id) AS run_count,
        (SELECT COUNT(*) FROM artifacts WHERE artifacts.task_id = tasks.id) AS artifact_count
      FROM tasks
      WHERE tasks.id = ?
      LIMIT 1
    `).get(normalizedTaskId);

    if (!taskRow) {
      throw new Error("找不到要下载的任务。");
    }

    const artifactRows = connection.prepare(`
      SELECT *
      FROM artifacts
      WHERE task_id = ?
      ORDER BY datetime(modified_at) ASC, id ASC
    `).all(normalizedTaskId);

    if (!artifactRows.length) {
      throw new Error("当前任务还没有可下载的归档产物。");
    }

    const task = mapTaskRow(taskRow);
    const cases = connection.prepare(`
      SELECT
        cases.*,
        (SELECT COUNT(*) FROM runs WHERE runs.case_id = cases.id) AS run_count,
        (SELECT COUNT(*) FROM artifacts WHERE artifacts.case_id = cases.id) AS artifact_count
      FROM cases
      WHERE cases.task_id = ?
      ORDER BY datetime(cases.updated_at) DESC, cases.id DESC
    `).all(normalizedTaskId).map(mapCaseRow);
    const runs = connection.prepare(`
      SELECT *
      FROM runs
      WHERE task_id = ?
      ORDER BY datetime(started_at) DESC, id DESC
    `).all(normalizedTaskId).map(mapRunRow);

    const rootName = `${sanitizeFileSegment(task.name || task.id, "task")}-${sanitizeFileSegment(task.id, "task")}`;
    const usedPaths = new Set();
    const entries = [];

    function ensureUniqueBundlePath(inputPath) {
      const normalizedPath = normalizeBundlePath(inputPath) || `${rootName}/artifact`;
      if (!usedPaths.has(normalizedPath)) {
        usedPaths.add(normalizedPath);
        return normalizedPath;
      }

      const extension = path.posix.extname(normalizedPath);
      const prefix = extension
        ? normalizedPath.slice(0, -extension.length)
        : normalizedPath;
      let index = 2;

      while (usedPaths.has(`${prefix}-${index}${extension}`)) {
        index += 1;
      }

      const nextPath = `${prefix}-${index}${extension}`;
      usedPaths.add(nextPath);
      return nextPath;
    }

    const manifest = {
      generatedAt: nowIso(),
      task,
      cases,
      runs,
      artifactCount: artifactRows.length,
      artifacts: artifactRows.map((row) => ({
        id: String(row.id),
        taskId: row.task_id ? String(row.task_id) : null,
        caseId: row.case_id ? String(row.case_id) : null,
        runId: row.run_id ? String(row.run_id) : null,
        ownerType: String(row.owner_type || "run"),
        bucket: String(row.bucket || ""),
        type: String(row.type || "log"),
        name: String(row.name || ""),
        relPath: String(row.rel_path || ""),
        contentType: String(row.content_type || "application/octet-stream"),
        sizeBytes: parseNumber(row.size_bytes, 0),
        modifiedAt: String(row.modified_at || "")
      }))
    };

    entries.push({
      path: `${rootName}/manifest.json`,
      content: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      modifiedAt: manifest.generatedAt
    });

    for (const row of artifactRows) {
      const artifact = mapArtifactRow(row);
      const ownerSegment = artifact.caseId
        ? path.posix.join("cases", sanitizeFileSegment(artifact.caseId, "case"))
        : artifact.runId
          ? path.posix.join("runs", sanitizeFileSegment(artifact.runId, "run"))
          : "artifacts";
      const bucketSegment = sanitizeFileSegment(artifact.bucket || artifact.type, "artifact");
      const artifactSegment = sanitizeFileSegment(artifact.id, "artifact");
      const relativeSegment = normalizeBundlePath(artifact.relPath || artifact.name || artifact.id);

      entries.push({
        path: ensureUniqueBundlePath(
          path.posix.join(rootName, ownerSegment, bucketSegment, artifactSegment, relativeSegment)
        ),
        content: row.content_blob,
        modifiedAt: artifact.modifiedAt
      });
    }

    return {
      fileName: `${rootName}.zip`,
      contentType: "application/zip",
      buffer: buildZipBuffer(entries)
    };
  }

  async function buildTaskSub2ApiBundle(taskId) {
    const connection = await getDatabase();
    const normalizedTaskId = String(taskId || "").trim();
    const taskRow = connection.prepare(`
      SELECT *
      FROM tasks
      WHERE tasks.id = ?
      LIMIT 1
    `).get(normalizedTaskId);

    if (!taskRow) {
      throw new Error("找不到要下载的任务。");
    }

    const sub2apiRows = connection.prepare(`
      SELECT *
      FROM artifacts
      WHERE task_id = ? AND type = 'token' AND rel_path LIKE '%/sub2api/%'
      ORDER BY datetime(modified_at) ASC, id ASC
    `).all(normalizedTaskId);
    const cpaRows = connection.prepare(`
      SELECT *
      FROM artifacts
      WHERE task_id = ? AND type = 'token' AND rel_path LIKE '%/cpa/%'
      ORDER BY datetime(modified_at) ASC, id ASC
    `).all(normalizedTaskId);

    if (!sub2apiRows.length && !cpaRows.length) {
      throw new Error("当前任务还没有可用的 token 文件。");
    }

    const task = mapTaskRow(taskRow);
    const sourceGroups = [
      {
        label: "Sub2Api",
        rows: sub2apiRows,
        readAccounts(payload) {
          return Array.isArray(payload?.accounts) ? payload.accounts : [];
        }
      },
      {
        label: "CPA",
        rows: cpaRows,
        readAccounts(payload) {
          const account = convertCpaPayloadToSub2ApiAccount(payload);
          return account ? [account] : [];
        }
      }
    ].filter((group) => group.rows.length > 0);

    let allAccounts = [];

    for (const group of sourceGroups) {
      const nextAccounts = [];

      for (const row of group.rows) {
        try {
          const payload = parseArtifactJsonBlob(row.content_blob);
          nextAccounts.push(...group.readAccounts(payload));
        } catch (error) {
          console.error(`读取 ${group.label} 文件失败 ${row.rel_path}:`, error);
        }
      }

      if (nextAccounts.length > 0) {
        allAccounts = nextAccounts;
        break;
      }
    }

    if (allAccounts.length === 0) {
      throw new Error("没有可转换的有效 token 数据。");
    }

    // 构建 Sub2Api payload
    const sub2apiPayload = {
      proxies: [],
      accounts: allAccounts
    };

    const rootName = `${sanitizeFileSegment(task.name || task.id, "task")}-${sanitizeFileSegment(task.id, "task")}`;
    const fileName = `${rootName}.sub2api.json`;
    const buffer = Buffer.from(JSON.stringify(sub2apiPayload, null, 2), "utf8");

    return {
      fileName,
      contentType: "application/json",
      buffer
    };
  }

  async function saveTask(payload) {
    const connection = await getDatabase();
    const normalizedTaskId = String(payload?.id || "").trim();
    const existingRow = normalizedTaskId
      ? connection.prepare("SELECT * FROM tasks WHERE id = ? LIMIT 1").get(normalizedTaskId)
      : null;
    const nextTask = writeTaskToDatabase(connection, {
      id: normalizedTaskId || undefined,
      name: payload?.name,
      status: payload?.status,
      sourceKind: payload?.sourceKind || existingRow?.source_kind || "manual",
      sourceRef: payload?.sourceRef || existingRow?.source_ref || "manual",
      createdAt: existingRow?.created_at || nowIso(),
      updatedAt: nowIso()
    });

    return {
      ...nextTask,
      planId: "",
      planName: "",
      siteName: "",
      runMode: "headless",
      totalCases: 0,
      completedCases: 0,
      successCases: 0,
      failedCases: 0,
      runCount: 0,
      caseCount: 0,
      artifactCount: 0,
      startedAt: nextTask.createdAt,
      finishedAt: ""
    };
  }

  async function deleteTask(taskId) {
    const connection = await getDatabase();
    const normalizedTaskId = String(taskId || "").trim();

    if (!normalizedTaskId) {
      throw new Error("缺少要删除的任务 ID。");
    }

    const existingRow = connection.prepare(`
      SELECT
        tasks.*,
        (SELECT COUNT(*) FROM runs WHERE runs.task_id = tasks.id) AS run_count,
        (SELECT COUNT(*) FROM cases WHERE cases.task_id = tasks.id) AS case_count,
        (SELECT COUNT(*) FROM artifacts WHERE artifacts.task_id = tasks.id) AS artifact_count
      FROM tasks
      WHERE tasks.id = ?
      LIMIT 1
    `).get(normalizedTaskId);

    if (!existingRow) {
      throw new Error("找不到要删除的任务。");
    }

    const runningRun = connection.prepare(`
      SELECT id
      FROM runs
      WHERE task_id = ? AND status IN ('running', 'stopping')
      LIMIT 1
    `).get(normalizedTaskId);

    if (runningRun) {
      throw new Error("运行中的任务不能删除，请先停止它。");
    }

    connection.prepare("DELETE FROM tasks WHERE id = ?").run(normalizedTaskId);
    return mapTaskRow(existingRow);
  }

  async function saveSite(payload) {
    const state = await readState();
    const existingIndex = state.sites.findIndex((site) => site.id === payload.id);
    const nextSite = normalizeSiteRecord({
      ...state.sites[existingIndex],
      ...payload
    });
    assertSafeConfig(nextSite, "site");

    if (existingIndex >= 0) {
      state.sites[existingIndex] = {
        ...state.sites[existingIndex],
        ...nextSite,
        createdAt: state.sites[existingIndex].createdAt,
        updatedAt: nowIso()
      };
    } else {
      state.sites.push(nextSite);
    }

    state.selectedSiteId = nextSite.id;
    await persistState(state);
    return nextSite;
  }

  async function deleteSite(siteId) {
    const normalizedSiteId = String(siteId || "").trim();
    if (!normalizedSiteId) {
      throw new Error("缺少要删除的站点 ID。");
    }

    const state = await readState();
    const existingIndex = state.sites.findIndex((site) => site.id === normalizedSiteId);

    if (existingIndex < 0) {
      throw new Error("找不到要删除的站点。");
    }

    const referencedPlans = state.plans.filter((plan) => plan.siteId === normalizedSiteId);
    if (referencedPlans.length) {
      const planNames = referencedPlans
        .slice(0, 3)
        .map((plan) => plan.name || plan.id)
        .join("、");
      const suffix = referencedPlans.length > 3 ? " 等方案" : "";
      throw new Error(
        `站点仍被 ${referencedPlans.length} 个方案引用，请先调整这些方案后再删除：${planNames}${suffix}`
      );
    }

    if (state.sites.length <= 1) {
      throw new Error("平台至少需要保留一个站点资源。");
    }

    const [deletedSite] = state.sites.splice(existingIndex, 1);

    if (state.selectedSiteId === normalizedSiteId) {
      state.selectedSiteId = state.sites[0]?.id || "";
    }

    await persistState(state);
    return deletedSite;
  }

  async function saveProfile(payload) {
    const state = await readState();
    const existingIndex = state.profiles.findIndex((profile) => profile.id === payload.id);
    const nextProfile = normalizeProfileRecord({
      ...state.profiles[existingIndex],
      ...payload
    });
    assertSafeConfig(nextProfile, "profile");

    if (existingIndex >= 0) {
      state.profiles[existingIndex] = {
        ...state.profiles[existingIndex],
        ...nextProfile,
        createdAt: state.profiles[existingIndex].createdAt,
        updatedAt: nowIso()
      };
    } else {
      state.profiles.push(nextProfile);
    }

    state.selectedProfileId = nextProfile.id;
    await persistState(state);
    return nextProfile;
  }

  async function saveMailConfig(payload) {
    const state = await readState();
    const existingIndex = state.mailConfigs.findIndex((mailConfig) => mailConfig.id === payload.id);
    const nextMailConfig = normalizeMailConfig({
      ...state.mailConfigs[existingIndex],
      ...payload
    });
    assertSafeConfig(nextMailConfig, "mailConfig");

    if (existingIndex >= 0) {
      state.mailConfigs[existingIndex] = {
        ...state.mailConfigs[existingIndex],
        ...nextMailConfig,
        createdAt: state.mailConfigs[existingIndex].createdAt,
        updatedAt: nowIso()
      };
    } else {
      state.mailConfigs.push(nextMailConfig);
    }

    state.selectedMailConfigId = nextMailConfig.id;
    await persistState(state);
    return nextMailConfig;
  }

  async function savePlan(payload) {
    const state = await readState();
    const existingIndex = state.plans.findIndex((plan) => plan.id === payload.id);
    const nextPlan = normalizePlanRecord(
      {
        ...state.plans[existingIndex],
        ...payload
      },
      state
    );
    assertSafeConfig(nextPlan, "plan");

    const siteExists = state.sites.some((site) => site.id === nextPlan.siteId);
    const profileExists = state.profiles.some((profile) => profile.id === nextPlan.profileId);
    const mailConfigExists = state.mailConfigs.some(
      (mailConfig) => mailConfig.id === nextPlan.mailConfigId
    );

    if (!siteExists) {
      throw new Error("测试方案关联的站点不存在。");
    }

    if (!profileExists) {
      throw new Error("测试方案关联的画像配置不存在。");
    }

    if (nextPlan.mailConfigId && !mailConfigExists) {
      throw new Error("测试方案关联的邮箱配置不存在。");
    }

    if (existingIndex >= 0) {
      state.plans[existingIndex] = {
        ...state.plans[existingIndex],
        ...nextPlan,
        createdAt: state.plans[existingIndex].createdAt,
        updatedAt: nowIso()
      };
    } else {
      state.plans.push(nextPlan);
    }

    state.selectedPlanId = nextPlan.id;
    state.selectedSiteId = nextPlan.siteId;
    state.selectedProfileId = nextPlan.profileId;
    state.selectedMailConfigId = nextPlan.mailConfigId;
    await persistState(state);
    return nextPlan;
  }

  async function deletePlan(planId) {
    const normalizedPlanId = String(planId || "").trim();
    if (!normalizedPlanId) {
      throw new Error("缺少要删除的方案 ID。");
    }

    const state = await readState();
    const existingIndex = state.plans.findIndex((plan) => plan.id === normalizedPlanId);

    if (existingIndex < 0) {
      throw new Error("找不到要删除的方案。");
    }

    if (state.plans.length <= 1) {
      throw new Error("平台至少需要保留一个测试方案。");
    }

    const [deletedPlan] = state.plans.splice(existingIndex, 1);

    if (state.selectedPlanId === normalizedPlanId) {
      state.selectedPlanId = state.plans[0]?.id || "";
      state.selectedSiteId = state.plans[0]?.siteId || state.selectedSiteId;
      state.selectedProfileId = state.plans[0]?.profileId || state.selectedProfileId;
      state.selectedMailConfigId = state.plans[0]?.mailConfigId || state.selectedMailConfigId;
    }

    await persistState(state);
    return deletedPlan;
  }

  async function deleteProfile(profileId) {
    const normalizedProfileId = String(profileId || "").trim();
    if (!normalizedProfileId) {
      throw new Error("缺少要删除的画像 ID。");
    }

    const state = await readState();
    const existingIndex = state.profiles.findIndex((profile) => profile.id === normalizedProfileId);

    if (existingIndex < 0) {
      throw new Error("找不到要删除的画像。");
    }

    const referencedPlans = state.plans.filter((plan) => plan.profileId === normalizedProfileId);
    if (referencedPlans.length) {
      const planNames = referencedPlans
        .slice(0, 3)
        .map((plan) => plan.name || plan.id)
        .join("、");
      const suffix = referencedPlans.length > 3 ? " 等方案" : "";
      throw new Error(
        `画像仍被 ${referencedPlans.length} 个方案引用，请先调整这些方案后再删除：${planNames}${suffix}`
      );
    }

    if (state.profiles.length <= 1) {
      throw new Error("平台至少需要保留一个画像配置。");
    }

    const [deletedProfile] = state.profiles.splice(existingIndex, 1);

    if (state.selectedProfileId === normalizedProfileId) {
      state.selectedProfileId = state.profiles[0]?.id || "";
    }

    await persistState(state);
    return deletedProfile;
  }

  async function deleteMailConfig(mailConfigId) {
    const normalizedMailConfigId = String(mailConfigId || "").trim();
    if (!normalizedMailConfigId) {
      throw new Error("缺少要删除的邮箱配置 ID。");
    }

    const state = await readState();
    const existingIndex = state.mailConfigs.findIndex(
      (mailConfig) => mailConfig.id === normalizedMailConfigId
    );

    if (existingIndex < 0) {
      throw new Error("找不到要删除的邮箱配置。");
    }

    const referencedPlans = state.plans.filter(
      (plan) => plan.mailConfigId === normalizedMailConfigId
    );
    if (referencedPlans.length) {
      const planNames = referencedPlans
        .slice(0, 3)
        .map((plan) => plan.name || plan.id)
        .join("、");
      const suffix = referencedPlans.length > 3 ? " 等方案" : "";
      throw new Error(
        `邮箱配置仍被 ${referencedPlans.length} 个方案引用，请先调整这些方案后再删除：${planNames}${suffix}`
      );
    }

    if (state.mailConfigs.length <= 1) {
      throw new Error("平台至少需要保留一个邮箱配置。");
    }

    const [deletedMailConfig] = state.mailConfigs.splice(existingIndex, 1);

    if (state.selectedMailConfigId === normalizedMailConfigId) {
      state.selectedMailConfigId = state.mailConfigs[0]?.id || "";
    }

    await persistState(state);
    return deletedMailConfig;
  }

  async function updateSystem(payload) {
    const state = await readState();
    const nextSystem = {
      ...state.system,
      defaultRunMode: payload.defaultRunMode === "headed" ? "headed" : "headless",
      continueAfterProtectedChallenge: parseBoolean(
        payload.continueAfterProtectedChallenge,
        state.system.continueAfterProtectedChallenge
      ),
      preferredLandingPage: normalizePreferredLandingPage(
        payload.preferredLandingPage || state.system.preferredLandingPage || "overview"
      ),
      notes: String(payload.notes ?? state.system.notes ?? ""),
      updatedAt: nowIso()
    };
    assertSafeConfig(nextSystem, "system");
    state.system = nextSystem;

    await persistState(state);
    return state.system;
  }

  async function testMailConfigConnection(mailConfigId) {
    const state = await readState();
    const mailConfig = state.mailConfigs.find((record) => record.id === mailConfigId);

    if (!mailConfig) {
      throw new Error("找不到要测试的邮箱配置。");
    }

    const readiness = getMailReadiness(mailConfig);
    if (!readiness.ready) {
      throw new Error(readiness.detail);
    }

    if (mailConfig.mode !== "temp-mail") {
      return {
        success: true,
        message: "IMAP 配置必填字段完整，可用于运行时接入。",
        mode: mailConfig.mode
      };
    }

    const fetch = (await import("node-fetch")).default;
    const createResponse = await fetch(`${mailConfig.baseUrl}/api/mailboxes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mailConfig.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    if (!createResponse.ok) {
      throw new Error(`连接失败: ${createResponse.status} ${createResponse.statusText}`);
    }

    const createData = await createResponse.json();
    const mailboxId = createData.mailbox?.id;
    const mailboxAddress = createData.mailbox?.full_address;

    if (mailboxId) {
      await fetch(`${mailConfig.baseUrl}/api/mailboxes/${mailboxId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${mailConfig.apiKey}`
        }
      }).catch(() => undefined);
    }

    return {
      success: true,
      mode: mailConfig.mode,
      message: "邮箱连接测试成功。",
      testEmail: mailboxAddress || ""
    };
  }

  async function activatePlan(planId, requestedMode) {
    const state = await readState();
    const plan = state.plans.find((record) => record.id === planId);

    if (!plan) {
      throw new Error("找不到要执行的测试方案。");
    }

    const site = state.sites.find((record) => record.id === plan.siteId);
    const profile = state.profiles.find((record) => record.id === plan.profileId);
    const mailConfig = state.mailConfigs.find((record) => record.id === plan.mailConfigId);
    const effectiveRunMode = requestedMode === "headed" ? "headed" : plan.runMode;
    const effectiveContinueAfterProtectedChallenge =
      plan.continueAfterProtectedChallenge || state.system.continueAfterProtectedChallenge;

    if (!site) {
      throw new Error("测试方案关联的站点不存在。");
    }

    if (!profile) {
      throw new Error("测试方案关联的画像不存在。");
    }

    validateHttpsUrl(site.startUrl);
    assertSafeConfig(profile);
    assertSafeConfig(mailConfig ?? {});

    state.selectedPlanId = plan.id;
    state.selectedSiteId = site.id;
    state.selectedProfileId = profile.id;
    state.selectedMailConfigId = mailConfig?.id || "";
    state.system.defaultRunMode = effectiveRunMode;
    state.system.updatedAt = nowIso();
    state.system.continueAfterProtectedChallenge = effectiveContinueAfterProtectedChallenge;
    await persistState(state);

    return {
      site,
      plan,
      profile,
      mailConfig
    };
  }

  async function buildOverview(runHistory, artifacts) {
    const state = await readState();
    const activeRun = runHistory.find(
      (run) => run.status === "running" || run.status === "stopping"
    );
    const latestRun = runHistory[0] ?? null;
    const readySites = state.sites.filter((site) => site.status === "ready").length;
    const readyMailConfigs = state.mailConfigs.filter(
      (mailConfig) => getMailReadiness(mailConfig).ready
    ).length;
    const reportCount = artifacts.filter((artifact) => artifact.type === "report").length;
    const tokenCount = artifacts.filter((artifact) => artifact.type === "token").length;
    const failedRuns = runHistory.filter((run) => run.status === "failed").length;

    return {
      summary: {
        siteCount: state.sites.length,
        planCount: state.plans.length,
        profileCount: state.profiles.length,
        mailConfigCount: state.mailConfigs.length,
        artifactCount: artifacts.length,
        readySites,
        readyMailConfigs,
        reportCount,
        tokenCount,
        failedRuns,
        activeRunStatus: activeRun?.status || "idle"
      },
      health: [
        {
          id: "sites",
          label: "站点资源",
          tone: readySites ? "success" : "warning",
          detail: readySites
            ? `${readySites} 个站点可运行`
            : "尚无可运行的目标站点"
        },
        {
          id: "plans",
          label: "测试方案",
          tone: state.plans.length ? "accent" : "warning",
          detail: state.plans.length
            ? `${state.plans.length} 套可复用方案`
            : "还没有测试方案"
        },
        {
          id: "mail",
          label: "邮箱接入",
          tone: readyMailConfigs ? "success" : "warning",
          detail: readyMailConfigs
            ? `${readyMailConfigs} 个邮箱配置已就绪`
            : "邮箱链路仍需配置"
        },
        {
          id: "runs",
          label: "最近运行",
          tone: latestRun?.status === "failed" ? "danger" : "neutral",
          detail: latestRun
            ? `${latestRun.planName || "未知方案"} · ${latestRun.status === "running"
                ? "运行中"
                : latestRun.status === "stopping"
                  ? "停止中"
                  : latestRun.status === "passed"
                    ? "已通过"
                    : latestRun.status === "failed"
                      ? "已失败"
                      : latestRun.status === "stopped"
                        ? "已停止"
                        : latestRun.status}`
            : "还没有运行记录"
        }
      ],
      recentRuns: runHistory.slice(0, 5),
      featuredSite:
        state.sites.find((site) => site.id === state.selectedSiteId) || state.sites[0] || null,
      featuredPlan:
        state.plans.find((plan) => plan.id === state.selectedPlanId) || state.plans[0] || null,
      system: state.system,
      updatedAt: state.updatedAt
    };
  }

  return {
    paths,
    validateHttpsUrl,
    readState,
    writeState,
    listTasks,
    listCases,
    listRuns,
    getRunById,
    saveRun,
    listArtifacts,
    archiveArtifactsForRun,
    getArtifactContent,
    getArtifactById,
    buildTaskDownloadBundle,
    buildTaskSub2ApiBundle,
    saveTask,
    deleteTask,
    saveSite,
    deleteSite,
    savePlan,
    deletePlan,
    saveProfile,
    deleteProfile,
    saveMailConfig,
    deleteMailConfig,
    updateSystem,
    testMailConfigConnection,
    activatePlan,
    buildOverview,
    getMailReadiness
  };
}
