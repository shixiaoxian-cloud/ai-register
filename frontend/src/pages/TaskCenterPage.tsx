import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatters";
import type { ArtifactEntry, CaseRecord, PlatformState, RunRecord, RunStatus, TaskMutation, TaskRecord, Tone } from "../lib/types";

type TaskLikeStatus = TaskRecord["status"] | RunStatus | string;
type CaseLikeStatus = CaseRecord["status"] | RunStatus | string;

function normalizeTaskStatus(status: TaskLikeStatus): TaskRecord["status"] {
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

function taskStatusTone(status: TaskLikeStatus): Tone {
  switch (normalizeTaskStatus(status)) {
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

function taskStatusLabel(status: TaskLikeStatus): string {
  switch (normalizeTaskStatus(status)) {
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

function normalizeCaseStatus(status: CaseLikeStatus): CaseRecord["status"] {
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

function caseStatusTone(status: CaseLikeStatus): Tone {
  switch (normalizeCaseStatus(status)) {
    case "running":
    case "retrying":
      return "accent";
    case "success":
      return "success";
    case "stopped":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function caseStatusLabel(status: CaseLikeStatus): string {
  switch (normalizeCaseStatus(status)) {
    case "pending":
      return "待执行";
    case "running":
      return "进行中";
    case "retrying":
      return "重试中";
    case "success":
      return "成功";
    case "stopped":
      return "已停止";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

export function TaskCenterPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [runCount, setRunCount] = useState("1");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [taskNameDraft, setTaskNameDraft] = useState("");
  const [taskStatusDraft, setTaskStatusDraft] = useState<TaskRecord["status"]>("pending");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const deferredLogSearch = useDeferredValue(logSearch);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [nextTasks, nextState, nextRunsPayload] = await Promise.all([
          api.getTasks(),
          api.getState(),
          api.getRuns()
        ]);
        if (cancelled) {
          return;
        }

        setTasks(nextTasks);
        setPlatformState(nextState.state);
        setRuns(nextRunsPayload.runs);
        setSelectedPlanId((current) => current || nextState.state.selectedPlanId || nextState.state.plans[0]?.id || "");
        setMode(nextState.state.system.defaultRunMode);
        setSelectedTaskId((current) =>
          nextTasks.some((task) => task.id === current)
            ? current
            : nextTasks[0]?.id || nextRunsPayload.runs[0]?.taskId || ""
        );
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
        setSelectedCaseId((current) =>
          nextCases.some((caseRecord) => caseRecord.id === current) ? current : nextCases[0]?.id || ""
        );
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
  const activeRun = runs.find((run) => run.status === "running" || run.status === "stopping") || null;

  function findLatestRunForTask(taskId: string) {
    return runs.find((run) => run.taskId === taskId) || null;
  }

  function findLatestRunForCase(caseId: string) {
    return runs.find((run) => run.caseId === caseId) || null;
  }

  const latestTaskRun = selectedTask ? findLatestRunForTask(selectedTask.id) : null;
  const latestCaseRun = selectedCase ? findLatestRunForCase(selectedCase.id) : null;
  const selectedTaskStatus = normalizeTaskStatus(latestTaskRun?.status || selectedTask?.status || "pending");
  const selectedCaseStatus = normalizeCaseStatus(latestCaseRun?.status || selectedCase?.status || "pending");
  const selectedStage = latestCaseRun?.latestStage || latestTaskRun?.latestStage || selectedCase?.latestStage || null;
  const selectedConclusion = latestCaseRun?.conclusion || latestTaskRun?.conclusion || null;
  const selectedInsight = latestCaseRun?.insight || latestTaskRun?.insight || null;
  const logEntries = latestCaseRun?.logs || latestTaskRun?.logs || selectedCase?.runs?.[0]?.logs || [];
  const visibleLogs = logEntries.filter((entry) =>
    entry.text.toLowerCase().includes(deferredLogSearch.toLowerCase())
  );
  const progressRatio =
    selectedTask && selectedTask.totalCases > 0
      ? Math.min(100, (selectedTask.completedCases / selectedTask.totalCases) * 100)
      : 0;
  const logStatusCopy =
    latestCaseRun?.status === "running" || latestCaseRun?.status === "stopping" || latestTaskRun?.status === "running" || latestTaskRun?.status === "stopping"
      ? "日志每 2.5 秒刷新一次，显示当前活跃运行的最新输出。"
      : "这里展示最近一次保存下来的控制台输出。";
  const selectedTaskHasRuns = Boolean((selectedTask?.runCount ?? 0) > 0 || latestTaskRun);
  const canEditTaskStatus = Boolean(selectedTask && !selectedTaskHasRuns && selectedTaskStatus !== "running");
  const canDeleteTask = Boolean(selectedTask && selectedTaskStatus !== "running");
  const taskMetaLabel =
    selectedTask?.planName && selectedTask.planName !== selectedTask.name
      ? `${selectedTask.planName} · ${selectedTask.siteName || "手动任务"}`
      : selectedTask?.siteName || "手动任务";

  const artifactsByType = artifacts.reduce<Record<string, ArtifactEntry[]>>((acc, artifact) => {
    const type = artifact.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(artifact);
    return acc;
  }, {});

  async function refreshTasks() {
    const [nextTasks, nextRunsPayload] = await Promise.all([api.getTasks(), api.getRuns()]);
    setTasks(nextTasks);
    setRuns(nextRunsPayload.runs);
    return nextTasks;
  }

  useEffect(() => {
    if (!selectedTask) {
      setTaskNameDraft("");
      setTaskStatusDraft("pending");
      return;
    }

    setTaskNameDraft(selectedTask.name);
    setTaskStatusDraft(selectedTask.status);
  }, [selectedTask]);

  async function handleCreateTask() {
    try {
      const defaultName = `手动任务 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
      const task = await api.saveTask({
        name: defaultName,
        status: "pending",
        sourceKind: "manual",
        sourceRef: "manual"
      });
      const refreshedTasks = await refreshTasks();
      setSelectedTaskId(refreshedTasks.find((entry) => entry.id === task.id)?.id || task.id);
      setSuccess("已创建草稿任务。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建任务失败。");
    }
  }

  async function handleSaveTask() {
    if (!selectedTask) {
      return;
    }

    try {
      const payload: TaskMutation = {
        id: selectedTask.id,
        name: taskNameDraft.trim() || selectedTask.name,
        status: canEditTaskStatus ? taskStatusDraft : selectedTask.status,
        sourceKind: selectedTask.sourceKind,
        sourceRef: selectedTask.sourceRef
      };
      await api.saveTask(payload);
      await refreshTasks();
      setSuccess("任务已保存。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存任务失败。");
    }
  }

  async function handleDeleteTask() {
    if (!selectedTask || !canDeleteTask) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除任务“${selectedTask.name}”吗？`);
    if (!shouldDelete) {
      return;
    }

    try {
      await api.deleteTask(selectedTask.id);
      const refreshedTasks = await refreshTasks();
      setSelectedTaskId(refreshedTasks[0]?.id || "");
      setSuccess("任务已删除。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除任务失败。");
    }
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
            <button type="button" className="ghost-button" onClick={handleCreateTask}>
              新建草稿任务
            </button>
            <button type="button" className="accent-button" onClick={handleStartRun}>
              启动新任务
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleStopRun}
              disabled={!activeRun}
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
                (() => {
                  const liveRun = findLatestRunForTask(task.id);
                  const displayStatus = liveRun?.status || task.status;

                  return (
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
                      <StatusPill tone={taskStatusTone(displayStatus)}>
                        {taskStatusLabel(displayStatus)}
                      </StatusPill>
                      <strong>{task.name}</strong>
                      <span>
                        {task.planName && task.planName !== task.name
                          ? `${task.planName} · ${task.siteName || "手动任务"}`
                          : task.siteName || "手动任务"}
                      </span>
                      <small>
                        {formatDateTime(liveRun?.startedAt || task.startedAt || task.createdAt)} · {task.completedCases}/{task.totalCases} 次
                      </small>
                    </button>
                  );
                })()
              ))
            ) : (
              <p className="empty-copy">还没有任务记录。</p>
            )}
          </div>
        </SectionCard>

        {/* 中间执行详情 */}
        <SectionCard
          title="执行详情"
          subtitle={
            selectedTask
              ? `${taskStatusLabel(selectedTaskStatus)} · ${formatDateTime(latestTaskRun?.startedAt || selectedTask.startedAt || selectedTask.createdAt)}`
              : "选择左侧任务查看详情。"
          }
        >
          {selectedTask ? (
            <div className="task-detail-grid">
              <div className="task-progress-card">
                <div className="task-progress-header">
                  <strong>任务管理</strong>
                  <div className="toolbar-row">
                    <button type="button" className="ghost-button" onClick={handleSaveTask}>
                      保存任务
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={handleDeleteTask}
                      disabled={!canDeleteTask}
                    >
                      删除任务
                    </button>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    任务名称
                    <input
                      value={taskNameDraft}
                      onChange={(event) => setTaskNameDraft(event.target.value)}
                      placeholder="输入任务名称"
                    />
                  </label>
                  <label>
                    任务状态
                    <select
                      value={canEditTaskStatus ? taskStatusDraft : selectedTask.status}
                      onChange={(event) => setTaskStatusDraft(event.target.value as TaskRecord["status"])}
                      disabled={!canEditTaskStatus}
                    >
                      <option value="pending">待执行</option>
                      <option value="running">运行中</option>
                      <option value="completed">已完成</option>
                      <option value="failed">失败</option>
                      <option value="stopped">已停止</option>
                    </select>
                  </label>
                </div>
                <p className="empty-copy">
                  {selectedTaskHasRuns
                    ? "当前任务已经关联执行记录，状态由运行结果驱动；这里仍可修改任务名称。"
                    : "草稿任务支持完整 CRUD，可手动维护名称和状态。"}
                </p>
                <p className="empty-copy">{taskMetaLabel}</p>
              </div>

              <div className="mini-card-grid">
                <article className="mini-card">
                  <span>任务状态</span>
                  <StatusPill tone={taskStatusTone(selectedTaskStatus)}>
                    {taskStatusLabel(selectedTaskStatus)}
                  </StatusPill>
                  <p>
                    {latestTaskRun?.status === "running" || latestTaskRun?.status === "stopping"
                      ? "当前任务正跟随活跃运行实时刷新。"
                      : "这里显示最近一次归档到平台的数据。"}
                  </p>
                </article>
                <article className="mini-card">
                  <span>最新阶段</span>
                  <strong>{selectedStage?.stageLabel || "尚无阶段信息"}</strong>
                  <p>{selectedStage?.details || "任务启动后，这里会显示最近识别到的阶段和结果。"}</p>
                </article>
                <article className="mini-card">
                  <span>实时输出</span>
                  <strong>{logEntries.length ? `${logEntries.length} 条日志` : "暂无输出"}</strong>
                  <p>{logStatusCopy}</p>
                </article>
              </div>

              {selectedConclusion ? (
                <article className={`insight-panel tone-${selectedConclusion.tone}`}>
                  <span>{selectedConclusion.title}</span>
                  <strong>{selectedConclusion.summary}</strong>
                  <p>{selectedConclusion.detail}</p>
                </article>
              ) : null}

              {selectedInsight ? (
                <article className="insight-panel tone-warning">
                  <span>{selectedInsight.title}</span>
                  <strong>需要人工关注</strong>
                  <p>{selectedInsight.message}</p>
                  <p>{selectedInsight.action}</p>
                </article>
              ) : null}

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
                      width: `${progressRatio}%`
                    }}
                  />
                </div>
              </div>

              {/* Case 时间线 */}
              <div className="case-timeline">
                <h3>执行时间线</h3>
                {cases.length ? (
                  cases.map((caseRecord) => {
                    const liveRun = findLatestRunForCase(caseRecord.id);
                    const displayStatus = liveRun?.status || caseRecord.status;
                    const displaySummary = liveRun?.summary || caseRecord.errorMessage;

                    // 从日志中提取邮箱信息
                    const logs = liveRun?.logs || caseRecord.runs?.[0]?.logs || [];
                    const emailLog = logs.find(entry => entry.text.includes('[TempMail] Created temporary email:'));
                    const emailMatch = emailLog?.text.match(/Created temporary email:\s*(.+)/);
                    const emailAddress = emailMatch ? emailMatch[1].trim() : null;

                    // 从日志中提取批次和重试信息
                    const executionLog = logs.find(entry => entry.text.includes('[执行]'));
                    const batchMatch = executionLog?.text.match(/第\s*(\d+)\s*批次\s*\/\s*共\s*(\d+)\s*批次/);
                    const retryMatch = executionLog?.text.match(/第\s*(\d+)\s*次尝试\s*\/\s*最多\s*(\d+)\s*次/);

                    const batchInfo = batchMatch ? `第 ${batchMatch[1]} 批次 / 共 ${batchMatch[2]} 批次` : null;
                    const retryInfo = retryMatch ? `第 ${retryMatch[1]} 次尝试` : null;

                    return (
                      <div
                        key={caseRecord.id}
                        className={selectedCase?.id === caseRecord.id ? "case-item is-active" : "case-item"}
                        onClick={() => setSelectedCaseId(caseRecord.id)}
                      >
                        <div className="case-item-header">
                          <StatusPill tone={caseStatusTone(displayStatus)}>
                            第{caseRecord.sequence}次 · {caseStatusLabel(displayStatus)}
                          </StatusPill>
                          {caseRecord.retryCount > 0 ? (
                            <span className="case-retry-badge">重试了 {caseRecord.retryCount} 次</span>
                          ) : null}
                        </div>
                        <div className="case-item-time">
                          {caseRecord.startedAt ? formatDateTime(caseRecord.startedAt) : "待执行"}
                          {caseRecord.finishedAt ? ` - ${formatDateTime(caseRecord.finishedAt)}` : ""}
                        </div>
                        {batchInfo || retryInfo ? (
                          <div className="case-meta-info">
                            {batchInfo ? <span>📊 {batchInfo}</span> : null}
                            {retryInfo ? <span>🔄 {retryInfo}</span> : null}
                          </div>
                        ) : null}
                        {emailAddress ? (
                          <div className="case-email-info">
                            📧 {emailAddress}
                          </div>
                        ) : null}
                        {displaySummary && normalizeCaseStatus(displayStatus) === "failed" ? (
                          <div className="case-error-message">
                            ❌ {displaySummary}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-copy">任务启动后，这里会显示每次执行的详情。</p>
                )}
              </div>

              {/* 日志区域 */}
              <div className="log-section">
                <div className="toolbar-row">
                  {selectedCase ? (
                    <StatusPill tone={caseStatusTone(selectedCaseStatus)}>
                      第{selectedCase.sequence}次 · {caseStatusLabel(selectedCaseStatus)}
                    </StatusPill>
                  ) : null}
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
                  {logEntries.length
                    ? visibleLogs.length
                    ? visibleLogs
                        .map(
                          (entry) =>
                            `[${formatDateTime(entry.at)}] [${entry.stream}] ${entry.text}`
                        )
                        .join("\n")
                    : "没有匹配当前搜索条件的日志。"
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
                <a
                  href={`/api/platform/tasks/${selectedTask.id}/download-sub2api`}
                  className="ghost-button"
                  download
                >
                  下载 Sub2Api 格式
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
