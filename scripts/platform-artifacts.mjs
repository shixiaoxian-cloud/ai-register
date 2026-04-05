import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

function normalizeRelPath(value) {
  return value.split(path.sep).join("/");
}

async function walkDirectory(rootPath, baseRelPath = "") {
  if (!existsSync(rootPath)) {
    return [];
  }

  const entries = await readdir(rootPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootPath, entry.name);
    const relativePath = baseRelPath ? path.join(baseRelPath, entry.name) : entry.name;

    if (entry.isDirectory()) {
      results.push(...(await walkDirectory(absolutePath, relativePath)));
      continue;
    }

    const fileStat = await stat(absolutePath);
    results.push({
      absolutePath,
      relPath: normalizeRelPath(relativePath),
      modifiedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size
    });
  }

  return results;
}

function classifyTestResultArtifact(entry) {
  const extension = path.extname(entry.relPath).toLowerCase();

  if (extension === ".zip") {
    return "trace";
  }

  if ([".png", ".jpg", ".jpeg", ".webm"].includes(extension)) {
    return "media";
  }

  return "log";
}

export function buildArtifactKey(entry) {
  return `${entry.bucket}:${entry.relPath}`;
}

export function buildArtifactSignature(entry) {
  return `${entry.modifiedAt}:${entry.sizeBytes}`;
}

export function createArtifactHref(bucket, relPath) {
  if (bucket === "reports" && relPath === "index.html") {
    return "/report";
  }

  return `/platform-files/${bucket}/${relPath}`;
}

export async function scanArtifactEntries(projectRoot) {
  const entries = [];
  const reportIndexPath = path.join(projectRoot, "playwright-report", "index.html");
  const rootLogPath = path.join(projectRoot, "test-output.log");

  if (existsSync(reportIndexPath)) {
    const reportStat = await stat(reportIndexPath);
    entries.push({
      id: buildArtifactKey({ bucket: "reports", relPath: "index.html" }),
      bucket: "reports",
      type: "report",
      name: "最新 Playwright 报告",
      relPath: "index.html",
      absolutePath: reportIndexPath,
      modifiedAt: reportStat.mtime.toISOString(),
      sizeBytes: reportStat.size,
      href: "/report"
    });
  }

  if (existsSync(rootLogPath)) {
    const logStat = await stat(rootLogPath);
    entries.push({
      id: buildArtifactKey({ bucket: "logs", relPath: "test-output.log" }),
      bucket: "logs",
      type: "log",
      name: "test-output.log",
      relPath: "test-output.log",
      absolutePath: rootLogPath,
      modifiedAt: logStat.mtime.toISOString(),
      sizeBytes: logStat.size,
      href: createArtifactHref("logs", "test-output.log")
    });
  }

  const outputTokenFiles = await walkDirectory(path.join(projectRoot, "output_tokens"));
  for (const file of outputTokenFiles) {
    entries.push({
      id: buildArtifactKey({ bucket: "tokens", relPath: file.relPath }),
      bucket: "tokens",
      type: "token",
      name: path.basename(file.relPath),
      relPath: file.relPath,
      absolutePath: file.absolutePath,
      modifiedAt: file.modifiedAt,
      sizeBytes: file.sizeBytes,
      href: createArtifactHref("tokens", file.relPath)
    });
  }

  const testResultFiles = await walkDirectory(path.join(projectRoot, "test-results"));
  for (const file of testResultFiles) {
    const type = classifyTestResultArtifact(file);
    entries.push({
      id: buildArtifactKey({
        bucket: type === "trace" ? "trace" : type === "media" ? "media" : "logs",
        relPath: file.relPath
      }),
      bucket: type === "trace" ? "trace" : type === "media" ? "media" : "logs",
      type,
      name: path.basename(file.relPath),
      relPath: file.relPath,
      absolutePath: file.absolutePath,
      modifiedAt: file.modifiedAt,
      sizeBytes: file.sizeBytes,
      href: createArtifactHref(
        type === "trace" ? "trace" : type === "media" ? "media" : "logs",
        file.relPath
      )
    });
  }

  const runtimeArtifactFiles = await walkDirectory(path.join(projectRoot, "artifacts"));
  for (const file of runtimeArtifactFiles) {
    if (!/\/tokens\//.test(`/${file.relPath}/`)) {
      continue;
    }

    entries.push({
      id: buildArtifactKey({ bucket: "tokens", relPath: `artifacts/${file.relPath}` }),
      bucket: "tokens",
      type: "token",
      name: path.basename(file.relPath),
      relPath: `artifacts/${file.relPath}`,
      absolutePath: file.absolutePath,
      modifiedAt: file.modifiedAt,
      sizeBytes: file.sizeBytes,
      href: createArtifactHref("tokens", `artifacts/${file.relPath}`)
    });
  }

  return entries.sort((left, right) =>
    right.modifiedAt.localeCompare(left.modifiedAt)
  );
}

export async function collectArtifactSnapshot(projectRoot) {
  const entries = await scanArtifactEntries(projectRoot);
  return new Map(
    entries.map((entry) => [buildArtifactKey(entry), buildArtifactSignature(entry)])
  );
}

export function attachRunIdsToArtifacts(entries, runHistory) {
  const artifactToRun = new Map();

  for (const run of runHistory) {
    for (const artifactKey of run.artifactKeys || []) {
      artifactToRun.set(artifactKey, run.id);
    }
  }

  return entries.map((entry) => ({
    ...entry,
    runId: artifactToRun.get(buildArtifactKey(entry)) || null
  }));
}
