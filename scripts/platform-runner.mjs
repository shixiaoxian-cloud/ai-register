import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  buildArtifactKey,
  buildArtifactSignature,
  collectArtifactSnapshot,
  scanArtifactEntries
} from "./platform-artifacts.mjs";

function nowIso() {
  return new Date().toISOString();
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;]*m/g, "");
}

function createPlatformRunId() {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRunCount(value) {
  const parsed = Number.parseInt(String(value ?? "1"), 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error("运行次数需为 1 到 20 之间的整数。");
  }

  return parsed;
}

function createInitialRunState(reportIndexPath) {
  return {
    status: "idle",
    mode: "headless",
    pid: null,
    runSequence: 0,
    platformRunId: null,
    command: "",
    startedAt: "",
    finishedAt: "",
    exitCode: null,
    reportAvailable: existsSync(reportIndexPath),
    logs: [],
    summary: "尚未执行测试。"
  };
}

function detectLatestStage(logs) {
  if (!Array.isArray(logs)) {
    return null;
  }

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const text = logs[index]?.text ?? "";
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

function appendEntries(logs, stream, chunk) {
  const nextLogs = Array.isArray(logs) ? [...logs] : [];
  const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
  const normalized = text.replace(/\r\n/g, "\n");

  for (const segment of normalized.split("\n")) {
    if (!segment.trim()) {
      continue;
    }

    nextLogs.push({
      at: nowIso(),
      stream,
      text: stripAnsi(segment)
    });
  }

  return nextLogs.length > 400 ? nextLogs.slice(nextLogs.length - 400) : nextLogs;
}

async function isProcessAlive(pid) {
  const normalizedPid = Number(pid);
  if (!Number.isInteger(normalizedPid) || normalizedPid <= 0) {
    return false;
  }

  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch {
    return false;
  }
}

function inferRecoveredRunState(record) {
  const lines = Array.isArray(record.logs)
    ? record.logs.map((entry) => stripAnsi(entry?.text || ""))
    : [];
  const joined = lines.join("\n");
  const explicitExit = [...joined.matchAll(/测试进程已结束，退出码：(-?\d+)/g)].at(-1);

  if (explicitExit) {
    const exitCode = Number(explicitExit[1]);
    return {
      status: exitCode === 0 ? "passed" : "failed",
      exitCode,
      summary:
        exitCode === 0
          ? "测试进程已结束，状态已自动回收为通过。"
          : `测试进程已结束，状态已自动回收为失败（退出码 ${exitCode}）。`
    };
  }

  if (/\b\d+\s+passed\b/i.test(joined) && !/\b\d+\s+failed\b/i.test(joined)) {
    return {
      status: "passed",
      exitCode: record.exitCode ?? 0,
      summary: "检测到测试结果已全部通过，状态已自动回收。"
    };
  }

  if (
    /\b\d+\s+failed\b/i.test(joined) ||
    /^\s*[✘x]\s+\d+\s+tests[\\/]+protection-validation\.spec\.ts/im.test(joined) ||
    /(TypeError|ReferenceError|RangeError|SyntaxError|AssertionError|TimeoutError|Error):/i.test(joined)
  ) {
    return {
      status: "failed",
      exitCode: record.exitCode ?? 1,
      summary: "检测到测试存在失败输出，状态已自动回收为失败。"
    };
  }

  return {
    status: "stopped",
    exitCode: record.exitCode ?? null,
    summary: "运行进程已不存在，状态已自动回收为已停止。"
  };
}

function detectRunInsight(run) {
  const combined = [
    run.summary ?? "",
    ...(Array.isArray(run.logs) ? run.logs.map((entry) => entry.text) : [])
  ].join("\n");

  if (
    /登录前安全检查页|请稍候|checking your browser|verify you are human|站点在登录前展示了安全检查页/i.test(
      combined
    )
  ) {
    return {
      type: "pre_auth_challenge",
      title: "登录前先触发了安全检查",
      message:
        "页面当前停留在“请稍候…”或同类验证页，登录按钮还没有真正渲染出来，所以脚本并不是没点，而是暂时没有可点的目标。",
      action:
        run.status === "running" || run.status === "stopping"
          ? "如果你已经开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true，请先在浏览器完成验证，再回到终端按回车继续。"
          : "可以先手动完成挑战后再重试，或者开启 CONTINUE_AFTER_PROTECTED_CHALLENGE=true 让脚本等待人工续跑。"
    };
  }

  return null;
}

function detectRunConclusion(run, latestStage, insight) {
  if (latestStage) {
    const stageText = latestStage.stageLabel;
    const detailText = latestStage.details || "未提供额外细节。";

    switch (latestStage.outcomeKind) {
      case "pre_auth_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "站点在登录按钮渲染前就进入了安全检查页。",
          detail: detailText,
          action:
            run.status === "running" || run.status === "stopping"
              ? "如已允许人工续跑，请先完成浏览器中的挑战，再返回控制台继续。"
              : "可以先手动完成挑战后再重试，或开启人工续跑。"
        };
      case "captcha":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了 CAPTCHA 人机校验阶段。",
          detail: detailText,
          action: "这通常说明该阶段的保护已生效。若要继续验证后续流程，可人工完成挑战后续跑。"
        };
      case "sms_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了短信验证码挑战。",
          detail: detailText,
          action: "这通常说明该阶段已触发二次验证。"
        };
      case "device_challenge":
        return {
          tone: "alert",
          title: `风控在${stageText}触发`,
          summary: "流程进入了设备或安全校验挑战。",
          detail: detailText,
          action: "建议记录截图、trace 和触发时机。"
        };
      case "blocked":
        return {
          tone: "alert",
          title: `流程在${stageText}被阻断`,
          summary: "站点已经展示阻断页或风险拦截提示。",
          detail: detailText,
          action: "可以把当前截图、阶段和 URL 作为验证证据。"
        };
      case "success":
        return {
          tone: "success",
          title: `流程在${stageText}后继续通过`,
          summary: "当前链路没有被阻断，已经进入成功态。",
          detail: detailText,
          action: "可以打开报告并对照不同站点或方案继续比较。"
        };
      case "email_code_requested":
        return {
          tone: "neutral",
          title: `流程推进到${stageText}`,
          summary: "当前进入邮箱验证码环节，属于业务校验步骤。",
          detail: detailText,
          action: "如需继续判断，请完成邮箱验证码链路。"
        };
      case "unknown":
        return {
          tone: "neutral",
          title: `流程在${stageText}后结果未明`,
          summary: "脚本已经推进到该阶段，但暂时没有识别出明确结果。",
          detail: detailText,
          action: "建议结合日志、截图和 trace 继续排查页面状态。"
        };
      default:
        break;
    }
  }

  if (insight?.type === "pre_auth_challenge") {
    return {
      tone: "alert",
      title: "风控在登录前触发",
      summary: "页面先进入了安全检查页，因此登录按钮没有真正出现。",
      detail: insight.message,
      action: insight.action
    };
  }

  if (run.status === "passed") {
    return {
      tone: "success",
      title: "本次流程执行完成",
      summary: "测试运行已结束，且当前没有记录到阻断性结果。",
      detail: run.summary ?? "未提供额外细节。",
      action: "可以打开测试报告，结合视频、截图和 trace 查看完整链路。"
    };
  }

  return null;
}

export function createRunController({
  projectRoot,
  reportIndexPath,
  activatePlan,
  listStoredRuns,
  getStoredRunById,
  saveStoredRun,
  listStoredArtifacts,
  archiveArtifactsForRun
}) {
  let runState = createInitialRunState(reportIndexPath);
  let currentChild = null;
  let runHistory = [];
  let historyLoaded = false;
  let activeRecord = null;
  let activeArtifactBaseline = new Map();

  async function ensureHistoryLoaded() {
    if (historyLoaded) {
      return;
    }

    const parsed = await listStoredRuns();
    runHistory = Array.isArray(parsed)
      ? parsed.map((record) => ({
          ...record,
          logs: Array.isArray(record.logs) ? record.logs : [],
          artifactKeys: Array.isArray(record.artifactKeys) ? record.artifactKeys : []
        }))
      : [];
    historyLoaded = true;
  }

  async function persistHistory() {
    await ensureHistoryLoaded();
    for (const record of runHistory) {
      await saveStoredRun(record);
    }
  }

  function refreshDerivedFields(record) {
    const latestStage = detectLatestStage(record.logs);
    const insight = detectRunInsight(record);
    const conclusion = detectRunConclusion(record, latestStage, insight);
    record.latestStage = latestStage;
    record.insight = insight;
    record.conclusion = conclusion;
  }

  function updateRecordFromRunState(record) {
    const latestStage = detectLatestStage(runState.logs);
    const insight = detectRunInsight(runState);
    const conclusion = detectRunConclusion(runState, latestStage, insight);
    record.status = runState.status;
    record.mode = runState.mode;
    record.summary = runState.summary;
    record.startedAt = runState.startedAt;
    record.finishedAt = runState.finishedAt;
    record.exitCode = runState.exitCode;
    record.command = runState.command;
    record.latestStage = latestStage;
    record.insight = insight;
    record.conclusion = conclusion;
    record.logs = runState.logs.slice(-200);
    record.reportAvailable = runState.reportAvailable;
    record.pid = runState.pid;
  }

  function appendLog(stream, chunk) {
    runState.logs = appendEntries(runState.logs, stream, chunk);

    if (activeRecord) {
      updateRecordFromRunState(activeRecord);
    }
  }

  function appendRecordLog(record, stream, chunk) {
    record.logs = appendEntries(record.logs, stream, chunk);
    refreshDerivedFields(record);
  }

  function getRunSnapshot() {
    const snapshot = {
      ...runState,
      reportAvailable: existsSync(reportIndexPath)
    };
    const latestStage = detectLatestStage(snapshot.logs);
    const insight = detectRunInsight(snapshot);

    return {
      ...snapshot,
      latestStage,
      insight,
      conclusion: detectRunConclusion(snapshot, latestStage, insight)
    };
  }

  async function listRuns() {
    await ensureHistoryLoaded();
    await reconcileInFlightRuns();
    if (activeRecord) {
      updateRecordFromRunState(activeRecord);
    }

    return [...runHistory].sort((left, right) =>
      String(right.startedAt || "").localeCompare(String(left.startedAt || ""))
    );
  }

  async function getRunById(runId) {
    await ensureHistoryLoaded();
    await reconcileInFlightRuns();
    if (activeRecord?.id === runId) {
      updateRecordFromRunState(activeRecord);
      return activeRecord;
    }

    const inMemoryRecord = runHistory.find((record) => record.id === runId);
    if (inMemoryRecord) {
      return inMemoryRecord;
    }

    return getStoredRunById(runId);
  }

  async function startRun(options) {
    await ensureHistoryLoaded();
    await reconcileInFlightRuns();

    if (
      currentChild ||
      runHistory.some((record) => record.status === "running" || record.status === "stopping")
    ) {
      throw new Error("当前已有测试任务正在运行，请等待结束或先停止它。");
    }

    const mode = options.mode === "headed" ? "headed" : "headless";
    const runCount = normalizeRunCount(options.runCount);
    const applied = await activatePlan(options.planId, mode);
    const isWindows = process.platform === "win32";
    const scriptName = mode === "headed" ? "test:headed" : "test";
    const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npm";
    activeArtifactBaseline = await collectArtifactSnapshot(projectRoot);
    const taskId = `task-${createPlatformRunId()}`;
    const caseId = `case-${createPlatformRunId()}`;
    const repeatEachArg = `--repeat-each=${runCount}`;
    const shellCommand = runCount > 1
      ? `npm run ${scriptName} -- ${repeatEachArg}`
      : `npm run ${scriptName}`;
    const args = isWindows
      ? ["/d", "/s", "/c", shellCommand]
      : runCount > 1
        ? ["run", scriptName, "--", repeatEachArg]
        : ["run", scriptName];

    runState = {
      status: "running",
      mode,
      pid: null,
      runSequence: runState.runSequence + 1,
      platformRunId: createPlatformRunId(),
      command: shellCommand,
      startedAt: nowIso(),
      finishedAt: "",
      exitCode: null,
      reportAvailable: existsSync(reportIndexPath),
      logs: [],
      summary:
        runCount > 1
          ? `已启动${mode === "headed" ? "可视化" : "无头"}浏览器测试，计划连续执行 ${runCount} 次。`
          : mode === "headed"
            ? "已启动可视化浏览器测试。"
            : "已启动无头模式测试。"
    };

    activeRecord = {
      id: runState.platformRunId,
      taskId,
      caseId,
      planId: applied.plan.id,
      planName: applied.plan.name,
      siteId: applied.site.id,
      siteName: applied.site.name,
      profileId: applied.profile.id,
      mailConfigId: applied.mailConfig?.id || null,
      browserEnvironmentConfigId: applied.browserEnvironmentConfig?.id || null,
      status: runState.status,
      mode,
      summary: runState.summary,
      command: runState.command,
      startedAt: runState.startedAt,
      finishedAt: "",
      exitCode: null,
      logs: [],
      latestStage: null,
      insight: null,
      conclusion: null,
      browserEnvironmentSummary: applied.browserEnvironmentSettings?.summary || null,
      artifactKeys: [],
      reportAvailable: false
    };
    runHistory.unshift(activeRecord);
    await persistHistory();

    appendLog("system", `任务已创建，模式：${mode}`);
    appendLog("system", `执行命令：${runState.command}`);
    appendLog("system", `站点：${applied.site.name}`);
    appendLog("system", `方案：${applied.plan.name}`);
    if (applied.browserEnvironmentConfig) {
      appendLog(
        "system",
        `浏览器环境：${applied.browserEnvironmentConfig.name} · ${applied.browserEnvironmentConfig.browserVersion} · ${applied.browserEnvironmentConfig.approvalStatus}`
      );
    }
    appendLog(
      "system",
      runCount > 1
        ? `任务计划连续执行 ${runCount} 次测试，每次执行均沿用现有重试逻辑。`
        : "任务计划执行 1 次测试，沿用现有重试逻辑。"
    );

    const childEnv = {
      ...process.env,
      FORCE_COLOR: "1",
      PLATFORM_TASK_ID: taskId,
      PLATFORM_RUN_ID: runState.platformRunId,
      PLATFORM_RUN_COUNT: String(runCount),
      TOKEN_OUTPUT_DIR: path.join(projectRoot, "output_tokens", taskId),
      ...(applied.browserEnvironmentSettings?.env || {})
    };

    currentChild = spawn(command, args, {
      cwd: projectRoot,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });

    runState.pid = currentChild.pid ?? null;
    updateRecordFromRunState(activeRecord);
    await persistHistory();

    currentChild.stdout?.on("data", (chunk) => {
      appendLog("stdout", chunk);
    });

    currentChild.stderr?.on("data", (chunk) => {
      appendLog("stderr", chunk);
    });

    currentChild.on("error", async (error) => {
      appendLog("stderr", `启动测试失败：${error.message}`);
      runState.status = "failed";
      runState.finishedAt = nowIso();
      runState.exitCode = -1;
      runState.summary = `测试进程启动失败：${error.message}`;
      if (activeRecord) {
        updateRecordFromRunState(activeRecord);
      }
      currentChild = null;
      await persistHistory();
    });

    currentChild.on("close", async (code, signal) => {
      const finalStatus =
        runState.status === "stopping" ? "stopped" : code === 0 ? "passed" : "failed";

      runState.status = finalStatus;
      runState.finishedAt = nowIso();
      runState.exitCode = code ?? null;
      runState.reportAvailable = existsSync(reportIndexPath);

      if (signal) {
        appendLog("system", `测试进程已结束，信号：${signal}`);
      } else {
        appendLog("system", `测试进程已结束，退出码：${code}`);
      }

      if (finalStatus === "passed") {
        runState.summary =
          runCount > 1
            ? `测试执行完成，计划的 ${runCount} 次执行均已通过。`
            : "测试执行完成，结果为通过。";
      } else if (finalStatus === "stopped") {
        runState.summary =
          runCount > 1
            ? `测试任务已由前端手动停止，原计划执行 ${runCount} 次。`
            : "测试任务已由前端手动停止。";
      } else {
        runState.summary =
          runCount > 1
            ? `测试执行结束，计划执行 ${runCount} 次，但存在失败或异常。`
            : "测试执行结束，但存在失败或异常。";
      }

      const insight = detectRunInsight(runState);
      if (finalStatus === "failed" && insight?.type === "pre_auth_challenge") {
        runState.summary = insight.title;
      }

      if (activeRecord) {
        const afterEntries = await scanArtifactEntries(projectRoot);
        activeRecord.artifactKeys = afterEntries
          .filter((entry) => {
            const artifactKey = buildArtifactKey(entry);
            return activeArtifactBaseline.get(artifactKey) !== buildArtifactSignature(entry);
          })
          .map((entry) => buildArtifactKey(entry));
        updateRecordFromRunState(activeRecord);
        await saveStoredRun(activeRecord);
        await archiveArtifactsForRun({
          runId: activeRecord.id,
          taskId: activeRecord.taskId || "",
          caseId: activeRecord.caseId || "",
          artifactKeys: activeRecord.artifactKeys
        });
      }

      currentChild = null;
      await persistHistory();
    });

    return getRunSnapshot();
  }

  async function stopRun() {
    await ensureHistoryLoaded();
    await reconcileInFlightRuns();

    if (!currentChild) {
      throw new Error("当前没有正在运行的测试任务。");
    }

    runState.status = "stopping";
    runState.summary = "正在请求停止测试任务...";
    appendLog("system", "收到停止请求，正在尝试终止测试进程。");

    if (process.platform === "win32" && runState.pid) {
      const killer = spawn("taskkill", ["/pid", String(runState.pid), "/t", "/f"], {
        stdio: ["ignore", "pipe", "pipe"]
      });

      killer.stdout?.on("data", (chunk) => appendLog("system", chunk));
      killer.stderr?.on("data", (chunk) => appendLog("stderr", chunk));
    } else {
      currentChild.kill();
    }

    if (activeRecord) {
      updateRecordFromRunState(activeRecord);
      await persistHistory();
    }

    return getRunSnapshot();
  }

  async function listArtifacts(filter = {}) {
    await ensureHistoryLoaded();
    return listStoredArtifacts(filter);
  }

  async function reconcileInFlightRuns() {
    await ensureHistoryLoaded();
    let changed = false;

    for (const record of runHistory) {
      if (record.status !== "running" && record.status !== "stopping") {
        continue;
      }

      if (activeRecord?.id === record.id && currentChild) {
        updateRecordFromRunState(activeRecord);
        continue;
      }

      const alive = await isProcessAlive(record.pid);
      if (alive) {
        continue;
      }

      const recovered = inferRecoveredRunState(record);
      record.status = recovered.status;
      record.exitCode = recovered.exitCode;
      record.finishedAt = record.finishedAt || nowIso();
      record.summary = recovered.summary;
      record.pid = null;
      appendRecordLog(record, "system", `检测到运行进程已不存在，任务状态已自动回收为${recovered.status}。`);
      changed = true;
    }

    if (changed) {
      await persistHistory();
    }
  }

  return {
    getRunSnapshot,
    listRuns,
    getRunById,
    startRun,
    stopRun,
    listArtifacts
  };
}
