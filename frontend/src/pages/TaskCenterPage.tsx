import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatters";
import type { ArtifactEntry, CaseRecord, PlatformState, TaskRecord, Tone } from "../lib/types";

function taskStatusTone(status: TaskRecord["status"]): Tone {
  switch (status) {
    case "running":
      return "accent";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "stopped":
      return "warning";
    default:
      return "neutral";
  }
}

function taskStatusLabel(status: TaskRecord["status"]): string {
  switch (status) {
    case "pending":
      return "待执行";
    case "running":
      return "运行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "stopped":
      return "已停止";
    default:
      return status;
  }
}

function caseStatusTone(status: CaseRecord["status"]): Tone {
  switch (status) {
    case "running":
    case "retrying":
      return "accent";
    case "success":
      return "success";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function caseStatusLabel(status: CaseRecord["status"]): string {
  switch (status) {
    case "pending":
      return "待执行";
    case "running":
      return "进行中";
    case "retrying":
      return "重试中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

export function TaskCenterPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [runCount, setRunCount] = useState("1");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const deferredLogSearch = useDeferredValue(logSearch);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [nextTasks, nextState] = await Promise.all([api.getTasks(), api.getState()]);
        if (cancelled) {
          return;
        }

        setTasks(nextTasks);
        setPlatformState(nextState.state);
        setSelectedPlanId((current) => current || nextState.state.selectedPlanId || nextState.state.plans[0]?.id || "");
        setMode(nextState.state.system.defaultRunMode);
        setSelectedTaskId((current) => current || nextTasks[0]?.id || "");
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取任务中心失败。");
        }
      }
    }

    loadData();
    const timer = window.setInterval(loadData, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selectedTaskId) {
      setCases([]);
      setArtifacts([]);
      return;
    }

    let cancelled = false;

    async function loadTaskDetails() {
      try {
        const [nextCases, nextArtifacts] = await Promise.all([
          api.getCases(selectedTaskId),
          api.getArtifacts({ taskId: selectedTaskId })
        ]);
        if (cancelled) {
          return;
        }

        setCases(nextCases);
        setArtifacts(nextArtifacts);
        setSelectedCaseId((current) => current || nextCases[0]?.id || "");
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load task details:", error);
        }
      }
    }

    loadTaskDetails();
    const timer = window.setInterval(loadTaskDetails, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedTaskId]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;
  const activeTask = tasks.find((task) => task.status === "running") || null;

  const visibleLogs = selectedCase?.runs?.[0]?.logs.filter((entry) =>
    entry.text.toLowerCase().includes(deferredLogSearch.toLowerCase())
  ) || [];

  const artifactsByType = artifacts.reduce<Record<string, ArtifactEntry[]>>((acc, artifact) => {
    const type = artifact.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(artifact);
    return acc;
  }, {});

  async function refreshTasks() {
    const nextTasks = await api.getTasks();
    setTasks(nextTasks);
    return nextTasks;
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
      const refreshedTasks = await refreshTasks();
      setSelectedTaskId(refreshedTasks[0]?.id || "");
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
      await refreshTasks();
      setSuccess("已发送停止指令。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "停止运行失败。");
    }
  }

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="任务中心"
        title="执行、进度、产物，一屏看全"
        description="以任务为主线索，实时监控每次执行的进度、日志和产物。不再需要在多个页面之间跳转。"
        actions={
          <>
            <button type="button" className="accent-button" onClick={handleStartRun}>
              启动新任务
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleStopRun}
              disabled={!activeTask}
            >
              停止当前任务
            </button>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard
        title="任务控制"
        subtitle="选择方案和运行参数，点击启动后任务会出现在下方列表中。"
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
            执行次数
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

      <div className="task-center-layout">
        {/* 左侧任务列表 */}
        <SectionCard
          title="任务列表"
          subtitle="最近的任务按时间倒序排列，点击查看详情。"
        >
          <div className="resource-list">
            {tasks.length ? (
              tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={selectedTask?.id === task.id ? "resource-chip is-active" : "resource-chip"}
                  onClick={() =>
                    startTransition(() => {
                      setSelectedTaskId(task.id);
                      setSuccess("");
                    })
                  }
                >
                  <StatusPill tone={taskStatusTone(task.status)}>
                    {taskStatusLabel(task.status)}
                  </StatusPill>
                  <strong>{task.planName || task.name}</strong>
                  <span>{task.siteName}</span>
                  <small>
                    {formatDateTime(task.startedAt || task.createdAt)} · {task.completedCases}/{task.totalCases} 次
                  </small>
                </button>
              ))
            ) : (
              <p className="empty-copy">还没有任务记录。</p>
            )}
          </div>
        </SectionCard>

        {/* 中间执行详情 */}
        <SectionCard
          title="执行详情"
          subtitle={selectedTask ? `任务开始于 ${formatDateTime(selectedTask.startedAt || selectedTask.createdAt)}` : "选择左侧任务查看详情。"}
        >
          {selectedTask ? (
            <div className="task-detail-grid">
              {/* 任务进度概览 */}
              <div className="task-progress-card">
                <div className="task-progress-header">
                  <strong>任务进度：{selectedTask.completedCases}/{selectedTask.totalCases}</strong>
                  <div className="task-progress-stats">
                    <span className="stat-success">✓ 成功 {selectedTask.successCases}</span>
                    <span className="stat-failed">✗ 失败 {selectedTask.failedCases}</span>
                  </div>
                </div>
                <div className="task-progress-bar">
                  <div
                    className="task-progress-fill"
                    style={{
                      width: `${(selectedTask.completedCases / selectedTask.totalCases) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Case 时间线 */}
              <div className="case-timeline">
                <h3>执行时间线</h3>
                {cases.length ? (
                  cases.map((caseRecord) => (
                    <div
                      key={caseRecord.id}
                      className={selectedCase?.id === caseRecord.id ? "case-item is-active" : "case-item"}
                      onClick={() => setSelectedCaseId(caseRecord.id)}
                    >
                      <div className="case-item-header">
                        <StatusPill tone={caseStatusTone(caseRecord.status)}>
                          第{caseRecord.sequence}次 · {caseStatusLabel(caseRecord.status)}
                        </StatusPill>
                        {caseRecord.retryCount > 0 ? (
                          <span className="case-retry-badge">重试了 {caseRecord.retryCount} 次</span>
                        ) : null}
                      </div>
                      <div className="case-item-time">
                        {caseRecord.startedAt ? formatDateTime(caseRecord.startedAt) : "待执行"}
                        {caseRecord.finishedAt ? ` - ${formatDateTime(caseRecord.finishedAt)}` : ""}
                      </div>
                      {caseRecord.errorMessage && caseRecord.status === "failed" ? (
                        <div className="case-error-message">
                          ❌ {caseRecord.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">任务启动后，这里会显示每次执行的详情。</p>
                )}
              </div>

              {/* 日志区域 */}
              <div className="log-section">
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
                </div>
                <pre className="log-console">
                  {visibleLogs.length
                    ? visibleLogs
                        .map(
                          (entry) =>
                            `[${formatDateTime(entry.at)}] [${entry.stream}] ${entry.text}`
                        )
                        .join("\n")
                    : "选择一个执行记录查看日志。"}
                </pre>
              </div>
            </div>
          ) : (
            <p className="empty-copy">启动一次任务后，这里会出现进度、时间线与日志。</p>
          )}
        </SectionCard>

        {/* 右侧产物面板 */}
        <SectionCard
          title="产物面板"
          subtitle={selectedTask ? "本次任务产生的所有产物" : "选择任务后显示产物"}
        >
          {selectedTask && artifacts.length > 0 ? (
            <div className="artifact-panel">
              {Object.entries(artifactsByType).map(([type, items]) => (
                <details key={type} className="artifact-group" open>
                  <summary className="artifact-group-header">
                    {type === "token" ? "🎫" : type === "report" ? "📄" : type === "screenshot" ? "📸" : "📦"}{" "}
                    {type === "token" ? "Token" : type === "report" ? "报告" : type === "screenshot" ? "截图" : "其他"}{" "}
                    ({items.length})
                  </summary>
                  <div className="artifact-list">
                    {items.map((artifact) => (
                      <div key={artifact.id} className="artifact-item">
                        <span className="artifact-name">{artifact.name}</span>
                        <a
                          href={artifact.href}
                          className="artifact-download"
                          download
                        >
                          下载
                        </a>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
              <div className="toolbar-row">
                <a
                  href={`/api/platform/tasks/${selectedTask.id}/download`}
                  className="accent-button"
                  download
                >
                  下载全部产物
                </a>
              </div>
            </div>
          ) : (
            <p className="empty-copy">任务完成后，产物会出现在这里。</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
