import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime, formatRunStatus, toneForStatus } from "../lib/formatters";
import type { PlatformState, RunRecord, RunStatus } from "../lib/types";

function statusLabel(status: RunStatus) {
  return formatRunStatus(status);
}

export function RunsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [runCount, setRunCount] = useState("1");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const deferredLogSearch = useDeferredValue(logSearch);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        const [{ runs: nextRuns }, nextState] = await Promise.all([api.getRuns(), api.getState()]);
        if (cancelled) {
          return;
        }

        setRuns(nextRuns);
        setPlatformState(nextState.state);
        setSelectedPlanId((current) => current || nextState.state.selectedPlanId || nextState.state.plans[0]?.id || "");
        setMode(nextState.state.system.defaultRunMode);
        setSelectedRunId((current) => current || nextRuns[0]?.id || "");
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取运行中心失败。");
        }
      }
    }

    loadRuns();
    const timer = window.setInterval(loadRuns, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || null;
  const activeRun = runs.find((run) => run.status === "running" || run.status === "stopping") || null;
  const visibleLogs = selectedRun?.logs.filter((entry) =>
    entry.text.toLowerCase().includes(deferredLogSearch.toLowerCase())
  ) || [];

  async function refreshRuns() {
    const payload = await api.getRuns();
    setRuns(payload.runs);
    return payload.runs;
  }

  async function handleStartRun() {
    try {
      if (!selectedPlanId) {
        throw new Error("请先选择一个测试方案。");
      }

      const parsedRunCount = Number.parseInt(runCount, 10);
      if (!Number.isInteger(parsedRunCount) || parsedRunCount < 1 || parsedRunCount > 20) {
        throw new Error("运行次数需为 1 到 20 之间的整数。");
      }

      await api.startRun(selectedPlanId, mode, parsedRunCount);
      const refreshedRuns = await refreshRuns();
      setSelectedRunId(refreshedRuns[0]?.id || "");
      setSuccess(
        parsedRunCount > 1
          ? `测试任务已启动，将连续执行 ${parsedRunCount} 次。`
          : "测试任务已启动。"
      );
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动运行失败。");
    }
  }

  async function handleStopRun() {
    try {
      await api.stopRun();
      await refreshRuns();
      setSuccess("已发送停止指令。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "停止运行失败。");
    }
  }

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="运行中心"
        title="执行不再藏在脚本后面"
        description="围绕测试方案发起运行、盯阶段、看日志、识别人工介入点，把执行和排查放在同一块画布里。"
        actions={
          <>
            <button type="button" className="accent-button" onClick={handleStartRun}>
              启动运行
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleStopRun}
              disabled={!activeRun}
            >
              停止当前运行
            </button>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard
        title="运行控制"
        subtitle="先选方案，再决定是否切到有头模式观察真实页面行为；运行次数大于 1 时会在同一任务内连续执行，并沿用现有重试逻辑。"
      >
        <div className="form-grid">
          <label>
            选择方案
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
            >
              {platformState?.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            运行模式
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "headless" | "headed")}
            >
              <option value="headless">无头模式</option>
              <option value="headed">有头模式</option>
            </select>
          </label>
          <label>
            运行次数
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={runCount}
              onChange={(event) => setRunCount(event.target.value)}
            />
          </label>
        </div>
      </SectionCard>

      <div className="editor-layout">
        <SectionCard
          title="运行记录"
          subtitle="把最近的执行实例组织成可比较的时间线，而不是只有一块实时日志。"
        >
          <div className="resource-list">
            {runs.length ? (
              runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className={selectedRun?.id === run.id ? "resource-chip is-active" : "resource-chip"}
                  onClick={() =>
                    startTransition(() => {
                      setSelectedRunId(run.id);
                      setSuccess("");
                    })
                  }
                >
                  <strong>{run.planName}</strong>
                  <span>{run.siteName}</span>
                  <small>{formatDateTime(run.startedAt)}</small>
                </button>
              ))
            ) : (
              <p className="empty-copy">还没有运行记录。</p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="运行详情"
          subtitle={selectedRun ? `运行开始于 ${formatDateTime(selectedRun.startedAt)}` : "选择左侧运行记录查看详情。"}
          actions={
            selectedRun ? (
              <>
                {selectedRun.taskId ? (
                  <a
                    href={`/api/platform/tasks/${encodeURIComponent(selectedRun.taskId)}/download`}
                    className="ghost-button"
                  >
                    下载任务包
                  </a>
                ) : null}
                {selectedRun.reportAvailable ? (
                  <a href="/report" target="_blank" rel="noreferrer" className="ghost-button">
                    打开报告
                  </a>
                ) : null}
              </>
            ) : null
          }
        >
          {selectedRun ? (
            <div className="run-detail-grid">
              <div className="run-detail-grid__summary">
                <StatusPill tone={toneForStatus(selectedRun.status)}>
                  {statusLabel(selectedRun.status)}
                </StatusPill>
                <strong>{selectedRun.planName}</strong>
                <p>{selectedRun.summary}</p>
              </div>

              <div className="mini-card-grid">
                <article className="mini-card">
                  <span>站点</span>
                  <strong>{selectedRun.siteName}</strong>
                </article>
                <article className="mini-card">
                  <span>最新阶段</span>
                  <strong>{selectedRun.latestStage?.stageLabel || "未识别"}</strong>
                </article>
                <article className="mini-card">
                  <span>退出码</span>
                  <strong>{selectedRun.exitCode ?? "—"}</strong>
                </article>
              </div>

              {selectedRun.conclusion ? (
                <article className={`insight-panel tone-${selectedRun.conclusion.tone}`}>
                  <span>{selectedRun.conclusion.title}</span>
                  <strong>{selectedRun.conclusion.summary}</strong>
                  <p>{selectedRun.conclusion.detail}</p>
                </article>
              ) : null}

              {selectedRun.insight ? (
                <article className="insight-panel tone-warning">
                  <span>{selectedRun.insight.title}</span>
                  <strong>需要人工关注</strong>
                  <p>{selectedRun.insight.message}</p>
                  <p>{selectedRun.insight.action}</p>
                </article>
              ) : null}

              <div className="toolbar-row">
                <input
                  className="search-input"
                  placeholder="搜索日志…"
                  value={logSearch}
                  onChange={(event) =>
                    startTransition(() => {
                      setLogSearch(event.target.value);
                    })
                  }
                />
                <Link to={`/artifacts${selectedRun ? `?runId=${selectedRun.id}` : ""}`} className="ghost-button">
                  关联产物
                </Link>
              </div>

              <pre className="log-console">
                {visibleLogs.length
                  ? visibleLogs
                      .map(
                        (entry) =>
                          `[${formatDateTime(entry.at)}] [${entry.stream}] ${entry.text}`
                      )
                      .join("\n")
                  : "暂无日志输出。"}
              </pre>
            </div>
          ) : (
            <p className="empty-copy">启动一次运行后，这里会出现阶段、结论与日志。</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
