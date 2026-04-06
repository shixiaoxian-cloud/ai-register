import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ActionIconButton } from "../components/ActionIconButton";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatArtifactType, formatBytes, formatDateTime } from "../lib/formatters";
import type {
  ArtifactEntry,
  CaseRecord,
  PlatformState,
  RunRecord,
  RunStatus,
  TaskMutation,
  TaskRecord,
  Tone
} from "../lib/types";

type TaskLikeStatus = TaskRecord["status"] | RunStatus | string;
type CaseLikeStatus = CaseRecord["status"] | RunStatus | string;
type DetailMode = "view" | "edit";

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

function caseStatusTone(status: CaseLikeStatus): Tone {
  switch (normalizeCaseStatus(status)) {
    case "running":
    case "retrying":
      return "accent";
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "stopped":
      return "warning";
    default:
      return "neutral";
  }
}

function taskStatusLabel(status: TaskLikeStatus) {
  const labels: Record<string, string> = {
    pending: "待执行",
    running: "运行中",
    completed: "已完成",
    failed: "失败",
    stopped: "已停止"
  };
  return labels[normalizeTaskStatus(status)] || String(status);
}

function caseStatusLabel(status: CaseLikeStatus) {
  const labels: Record<string, string> = {
    pending: "待执行",
    running: "进行中",
    retrying: "重试中",
    success: "成功",
    failed: "失败",
    stopped: "已停止"
  };
  return labels[normalizeCaseStatus(status)] || String(status);
}

export function TaskCenterPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState(searchParams.get("taskId") || "");
  const [selectedCaseId, setSelectedCaseId] = useState(searchParams.get("caseId") || "");
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [runCount, setRunCount] = useState("1");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [taskNameDraft, setTaskNameDraft] = useState("");
  const [taskStatusDraft, setTaskStatusDraft] = useState<TaskRecord["status"]>("pending");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const deferredTaskSearch = useDeferredValue(taskSearch);
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
        setSelectedPlanId(
          (current) => current || nextState.state.selectedPlanId || nextState.state.plans[0]?.id || ""
        );
        setMode(nextState.state.system.defaultRunMode);
        setSelectedTaskId((current) => {
          const preferredId = searchParams.get("taskId") || current;
          return nextTasks.some((task) => task.id === preferredId) ? preferredId : nextTasks[0]?.id || "";
        });
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
        setSelectedCaseId((current) => {
          const preferredId = searchParams.get("caseId") || current;
          return nextCases.some((item) => item.id === preferredId) ? preferredId : nextCases[0]?.id || "";
        });
      } catch {
        if (!cancelled) {
          setMessage("读取任务详情失败。");
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

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTaskId) {
      params.set("taskId", selectedTaskId);
    } else {
      params.delete("taskId");
    }
    if (selectedCaseId) {
      params.set("caseId", selectedCaseId);
    } else {
      params.delete("caseId");
    }
    setSearchParams(params, { replace: true });
  }, [selectedTaskId, selectedCaseId, setSearchParams]);

  const visibleTasks = tasks.filter((task) => {
    const query = deferredTaskSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [task.name, task.planName, task.siteName, task.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const selectedCase = cases.find((caseRecord) => caseRecord.id === selectedCaseId) || null;
  const activeRun = runs.find((run) => run.status === "running" || run.status === "stopping") || null;

  function findLatestRunForTask(taskId: string) {
    return runs.find((run) => run.taskId === taskId) || null;
  }

  function findLatestRunForCase(caseId: string) {
    return runs.find((run) => run.caseId === caseId) || null;
  }

  const latestTaskRun = selectedTask ? findLatestRunForTask(selectedTask.id) : null;
  const latestCaseRun = selectedCase ? findLatestRunForCase(selectedCase.id) : null;
  const currentRun = latestCaseRun || latestTaskRun || null;
  const logEntries = currentRun?.logs || [];
  const visibleLogs = logEntries.filter((entry) =>
    entry.text.toLowerCase().includes(deferredLogSearch.toLowerCase())
  );
  const selectedTaskHasRuns = Boolean((selectedTask?.runCount ?? 0) > 0 || latestTaskRun);
  const canEditTaskStatus = Boolean(selectedTask && !selectedTaskHasRuns && selectedTask?.status !== "running");
  const canDeleteTask = Boolean(selectedTask && normalizeTaskStatus(latestTaskRun?.status || selectedTask.status) !== "running");

  useEffect(() => {
    if (!selectedTask) {
      setTaskNameDraft("");
      setTaskStatusDraft("pending");
      return;
    }

    setTaskNameDraft(selectedTask.name);
    setTaskStatusDraft(selectedTask.status);
  }, [selectedTask]);

  async function refreshTasks() {
    const [nextTasks, nextRunsPayload] = await Promise.all([api.getTasks(), api.getRuns()]);
    setTasks(nextTasks);
    setRuns(nextRunsPayload.runs);
    return nextTasks;
  }

  async function handleCreateTask() {
    try {
      const defaultName = `手动任务 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
      const task = await api.saveTask({ name: defaultName, status: "pending", sourceKind: "manual", sourceRef: "manual" });
      const refreshedTasks = await refreshTasks();
      setSelectedTaskId(refreshedTasks.find((entry) => entry.id === task.id)?.id || task.id);
      setDetailMode("edit");
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
      setDetailMode("view");
      setSuccess("任务已保存。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存任务失败。");
    }
  }

  async function handleDeleteTask(task: TaskRecord) {
    const latestRun = findLatestRunForTask(task.id);
    const rowCanDelete = normalizeTaskStatus(latestRun?.status || task.status) !== "running";
    if (!rowCanDelete) {
      return;
    }

    const shouldDelete = window.confirm(`确认删除任务“${task.name}”吗？`);
    if (!shouldDelete) {
      return;
    }

    try {
      await api.deleteTask(task.id);
      const refreshedTasks = await refreshTasks();
      setSelectedTaskId(refreshedTasks[0]?.id || "");
      setDetailMode("view");
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
      setSuccess(parsedRunCount > 1 ? `测试任务已启动，将连续执行 ${parsedRunCount} 次。` : "测试任务已启动。");
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
        title="任务、批次、产物都回到一张台账"
        description="这里按任务看整体编排和执行批次。单次运行细节去运行流水，任务级产物和日志闭环留在这里。"
        actions={
          <>
            <button type="button" className="ghost-button" onClick={handleCreateTask}>
              新建草稿任务
            </button>
            <button type="button" className="accent-button" onClick={handleStartRun}>
              启动新任务
            </button>
            <button type="button" className="ghost-button" onClick={handleStopRun} disabled={!activeRun}>
              停止当前任务
            </button>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard title="任务发起台" subtitle="先选方案，再设定模式和连续执行次数。">
        <div className="panel-toolbar panel-toolbar--split">
          <div className="form-grid compact-grid">
            <label>
              方案
              <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                {platformState?.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模式
              <select value={mode} onChange={(event) => setMode(event.target.value as "headless" | "headed")}>
                <option value="headless">无头模式</option>
                <option value="headed">有头模式</option>
              </select>
            </label>
            <label>
              次数
              <input type="number" min={1} max={20} step={1} value={runCount} onChange={(event) => setRunCount(event.target.value)} />
            </label>
          </div>
          <label className="inline-search">
            <input
              value={taskSearch}
              placeholder="搜索任务 / 方案 / 站点"
              onChange={(event) =>
                startTransition(() => {
                  setTaskSearch(event.target.value);
                })
              }
            />
          </label>
        </div>
      </SectionCard>

      <div className="detail-layout">
        <SectionCard title="任务台账" subtitle="按任务聚合查看状态、进度和操作入口。">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>任务</th>
                  <th>方案 / 站点</th>
                  <th>状态</th>
                  <th>进度</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.length ? (
                  visibleTasks.map((task) => {
                    const liveRun = findLatestRunForTask(task.id);
                    const displayStatus = liveRun?.status || task.status;
                    const rowCanDelete = normalizeTaskStatus(displayStatus) !== "running";
                    return (
                      <tr
                        key={task.id}
                        className={selectedTask?.id === task.id ? "is-selected" : undefined}
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setDetailMode("view");
                        }}
                      >
                        <td>
                          <div className="table-primary">
                            <strong>{task.name}</strong>
                            <span>{task.sourceKind}</span>
                          </div>
                        </td>
                        <td>{task.planName ? `${task.planName} / ${task.siteName || "手动任务"}` : task.siteName || "手动任务"}</td>
                        <td>
                          <StatusPill tone={taskStatusTone(displayStatus)}>{taskStatusLabel(displayStatus)}</StatusPill>
                        </td>
                        <td>{`${task.completedCases}/${task.totalCases}`}</td>
                        <td>{formatDateTime(liveRun?.startedAt || task.startedAt || task.createdAt)}</td>
                        <td>
                          <div className="table-actions">
                            <ActionIconButton icon="view" label="查看" tone="accent" onClick={() => { setSelectedTaskId(task.id); setDetailMode("view"); }} />
                            <ActionIconButton icon="edit" label="修改" onClick={() => { setSelectedTaskId(task.id); setDetailMode("edit"); }} />
                            <ActionIconButton icon="delete" label="删除" tone="danger" disabled={!rowCanDelete} onClick={() => handleDeleteTask(task)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      还没有任务记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={selectedTask ? `任务详情 · ${selectedTask.name}` : "任务详情"}
          subtitle={selectedTask ? `${taskStatusLabel(latestTaskRun?.status || selectedTask.status)} · ${formatDateTime(latestTaskRun?.startedAt || selectedTask.startedAt || selectedTask.createdAt)}` : "选择左侧任务查看详情。"}
          actions={
            selectedTask ? (
              <div className="panel-toolbar">
                <StatusPill tone={detailMode === "edit" ? "accent" : "neutral"}>{detailMode === "edit" ? "修改模式" : "查看模式"}</StatusPill>
                {detailMode === "view" ? (
                  <button type="button" className="ghost-button" onClick={() => setDetailMode("edit")}>
                    切换到修改
                  </button>
                ) : null}
              </div>
            ) : null
          }
        >
          {selectedTask ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>任务状态</span>
                  <strong>{taskStatusLabel(latestTaskRun?.status || selectedTask.status)}</strong>
                  <p>{selectedTask.planName ? `${selectedTask.planName} / ${selectedTask.siteName}` : selectedTask.siteName || "手动任务"}</p>
                </div>
                <div>
                  <span>任务进度</span>
                  <strong>{`${selectedTask.completedCases}/${selectedTask.totalCases}`}</strong>
                  <p>{`成功 ${selectedTask.successCases} / 失败 ${selectedTask.failedCases}`}</p>
                </div>
              </div>

              <div className="form-grid compact-grid">
                <label>
                  任务名称
                  <input value={taskNameDraft} disabled={detailMode !== "edit"} onChange={(event) => setTaskNameDraft(event.target.value)} />
                </label>
                <label>
                  任务状态
                  <select
                    value={canEditTaskStatus ? taskStatusDraft : selectedTask.status}
                    disabled={detailMode !== "edit" || !canEditTaskStatus}
                    onChange={(event) => setTaskStatusDraft(event.target.value as TaskRecord["status"])}
                  >
                    <option value="pending">待执行</option>
                    <option value="running">运行中</option>
                    <option value="completed">已完成</option>
                    <option value="failed">失败</option>
                    <option value="stopped">已停止</option>
                  </select>
                </label>
              </div>

              <div className="form-footer form-footer--split">
                {detailMode === "edit" ? (
                  <button type="button" className="accent-button" onClick={handleSaveTask}>
                    保存任务
                  </button>
                ) : (
                  <p className="empty-copy">查看模式下不允许修改任务名称和可编辑状态。</p>
                )}
                <button type="button" className="danger-button" disabled={!canDeleteTask} onClick={() => handleDeleteTask(selectedTask)}>
                  删除任务
                </button>
              </div>

              {currentRun?.conclusion ? (
                <article className={`insight-panel tone-${currentRun.conclusion.tone}`}>
                  <span>{currentRun.conclusion.title}</span>
                  <strong>{currentRun.conclusion.summary}</strong>
                  <p>{currentRun.conclusion.detail}</p>
                </article>
              ) : null}

              {currentRun?.insight ? (
                <article className="insight-panel tone-warning">
                  <span>{currentRun.insight.title}</span>
                  <strong>需要人工关注</strong>
                  <p>{currentRun.insight.message}</p>
                  <p>{currentRun.insight.action}</p>
                </article>
              ) : null}

              <SectionCard title="执行批次" subtitle="每个批次都作为独立的 case 留在任务下，便于定位失败点。">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>批次</th>
                        <th>状态</th>
                        <th>时间</th>
                        <th>重试</th>
                        <th>错误</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.length ? (
                        cases.map((caseRecord) => {
                          const liveRun = findLatestRunForCase(caseRecord.id);
                          const displayStatus = liveRun?.status || caseRecord.status;
                          return (
                            <tr
                              key={caseRecord.id}
                              className={selectedCase?.id === caseRecord.id ? "is-selected" : undefined}
                              onClick={() => setSelectedCaseId(caseRecord.id)}
                            >
                              <td>{`第 ${caseRecord.sequence} 次`}</td>
                              <td>
                                <StatusPill tone={caseStatusTone(displayStatus)}>{caseStatusLabel(displayStatus)}</StatusPill>
                              </td>
                              <td>{caseRecord.startedAt ? `${formatDateTime(caseRecord.startedAt)}${caseRecord.finishedAt ? ` - ${formatDateTime(caseRecord.finishedAt)}` : ""}` : "待执行"}</td>
                              <td>{caseRecord.retryCount}</td>
                              <td>{caseRecord.errorMessage || "—"}</td>
                              <td>
                                <div className="table-actions">
                                  <ActionIconButton icon="view" label="查看批次" tone="accent" onClick={() => setSelectedCaseId(caseRecord.id)} />
                                  {liveRun?.id ? (
                                    <ActionIconButton icon="logs" label="运行流水" onClick={() => navigate(`/runs?runId=${encodeURIComponent(liveRun.id)}`)} />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="table-empty">
                            任务启动后，这里会出现批次记录。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <div className="panel-toolbar panel-toolbar--split">
                <label className="inline-search">
                  <input value={logSearch} placeholder="搜索任务 / 批次日志" onChange={(event) => startTransition(() => setLogSearch(event.target.value))} />
                </label>
                <div className="panel-toolbar">
                  <button type="button" className="ghost-button" onClick={() => navigate(`/artifacts?taskId=${encodeURIComponent(selectedTask.id)}`)}>
                    打开产物中心
                  </button>
                  <a href={`/api/platform/tasks/${selectedTask.id}/download`} className="ghost-button" download>
                    下载任务包
                  </a>
                  <a href={`/api/platform/tasks/${selectedTask.id}/download-sub2api`} className="ghost-button" download>
                    下载 Sub2Api
                  </a>
                </div>
              </div>

              <pre className="log-console">
                {logEntries.length
                  ? visibleLogs.length
                    ? visibleLogs
                        .map((entry) => `[${formatDateTime(entry.at)}] [${entry.stream}] ${entry.text}`)
                        .join("\n")
                    : "没有匹配当前搜索条件的日志。"
                  : "选择一个任务或批次后，这里会展示日志。"}
              </pre>

              <SectionCard title="任务产物" subtitle="这里展示任务维度下沉淀的所有产物，点行后可直接打开或下载。">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>类型</th>
                        <th>文件</th>
                        <th>更新时间</th>
                        <th>大小</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artifacts.length ? (
                        artifacts.map((artifact) => (
                          <tr key={artifact.id}>
                            <td>{formatArtifactType(artifact.type)}</td>
                            <td>
                              <div className="table-primary">
                                <strong>{artifact.name}</strong>
                                <span>{artifact.relPath}</span>
                              </div>
                            </td>
                            <td>{formatDateTime(artifact.modifiedAt)}</td>
                            <td>{formatBytes(artifact.sizeBytes)}</td>
                            <td>
                              <div className="table-actions">
                                <ActionIconButton icon="open" label="打开" tone="accent" href={artifact.href} target="_blank" rel="noreferrer" />
                                <ActionIconButton icon="download" label="下载" href={artifact.href} download />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="table-empty">
                            任务完成后，产物会出现在这里。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          ) : (
            <p className="empty-copy">启动一次任务后，这里会出现任务详情、批次、日志和产物。</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
