import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ActionIconButton } from "../components/ActionIconButton";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import {
  formatDateTime,
  formatRunStatus,
  toneForStatus
} from "../lib/formatters";
import type { PlatformState, RunRecord, RunStatus } from "../lib/types";

function statusLabel(status: RunStatus) {
  return formatRunStatus(status);
}

export function RunsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [selectedRunId, setSelectedRunId] = useState(searchParams.get("runId") || "");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [mode, setMode] = useState<"headless" | "headed">("headless");
  const [runCount, setRunCount] = useState("1");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
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
        setSelectedPlanId(
          (current) => current || nextState.state.selectedPlanId || nextState.state.plans[0]?.id || ""
        );
        setMode(nextState.state.system.defaultRunMode);
        setSelectedRunId((current) => {
          const preferredId = searchParams.get("runId") || current;
          return nextRuns.some((run) => run.id === preferredId) ? preferredId : nextRuns[0]?.id || "";
        });
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取运行流水失败。");
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

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedRunId) {
      params.set("runId", selectedRunId);
    } else {
      params.delete("runId");
    }
    setSearchParams(params, { replace: true });
  }, [selectedRunId, setSearchParams]);

  const visibleRuns = runs.filter((run) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [run.planName, run.siteName, run.status, run.latestStage?.stageLabel, run.summary]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || null;
  const activeRun = runs.find((run) => run.status === "running" || run.status === "stopping") || null;
  const selectedPlan =
    platformState?.plans.find((plan) => plan.id === selectedPlanId) || null;
  const visibleLogs =
    selectedRun?.logs.filter((entry) =>
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
      setSuccess(parsedRunCount > 1 ? `测试已启动，计划连续执行 ${parsedRunCount} 次。` : "测试已启动。");
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
        eyebrow="运行流水"
        title="单次运行回到统一流水台账"
        description="这里按单次运行记录看阶段、状态、日志和人工介入点。任务中心看整体编排，这里看每一次真实执行。"
        actions={
          <>
            <button type="button" className="accent-button" onClick={handleStartRun}>
              启动运行
            </button>
            <button type="button" className="ghost-button" onClick={handleStopRun} disabled={!activeRun}>
              停止当前运行
            </button>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard
        title="运行控制"
        subtitle="先选方案，再决定是否切换有头模式；连续执行次数会在同一任务内串行完成。"
      >
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
              value={search}
              placeholder="搜索方案 / 站点 / 状态 / 阶段"
              onChange={(event) =>
                startTransition(() => {
                  setSearch(event.target.value);
                })
              }
            />
          </label>
        </div>
        <div className="control-summary-grid">
          <div>
            <span>当前活动</span>
            <strong>{activeRun ? "运行中" : "当前空闲"}</strong>
            <p>{activeRun ? `${activeRun.planName} · ${activeRun.siteName}` : "发起一次运行后，这里会持续展示最新执行上下文。"}</p>
          </div>
          <div>
            <span>已选方案</span>
            <strong>{selectedPlan?.name || "未选择方案"}</strong>
            <p>{selectedPlan?.description || "当前会沿用所选方案的站点、画像和邮箱组合。"}</p>
          </div>
          <div>
            <span>执行方式</span>
            <strong>{mode === "headed" ? "有头模式" : "无头模式"}</strong>
            <p>{`计划连续执行 ${runCount} 次。`}</p>
          </div>
        </div>
      </SectionCard>

      <div className="detail-layout detail-layout--wide">
        <SectionCard title="运行台账" subtitle="左侧列表按时间倒序排列，点击即可查看右侧详情。">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>方案</th>
                  <th>站点</th>
                  <th>阶段</th>
                  <th>状态</th>
                  <th>开始时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.length ? (
                  visibleRuns.map((run) => (
                    <tr
                      key={run.id}
                      className={selectedRun?.id === run.id ? "is-selected" : undefined}
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <td>
                        <div className="table-primary">
                          <strong>{run.planName}</strong>
                          <span>{run.summary}</span>
                        </div>
                      </td>
                      <td>{run.siteName}</td>
                      <td>{run.latestStage?.stageLabel || "尚无阶段信息"}</td>
                      <td>
                        <StatusPill tone={toneForStatus(run.status)}>{statusLabel(run.status)}</StatusPill>
                      </td>
                      <td>{formatDateTime(run.startedAt)}</td>
                      <td>
                        <div className="table-actions">
                          <ActionIconButton icon="view" label="查看" tone="accent" onClick={() => setSelectedRunId(run.id)} />
                          {run.taskId ? (
                            <ActionIconButton
                              icon="logs"
                              label="查看任务"
                              onClick={() => navigate(`/tasks?taskId=${encodeURIComponent(run.taskId || "")}`)}
                            />
                          ) : null}
                          <ActionIconButton
                            icon="open"
                            label="查看产物"
                            onClick={() => navigate(`/artifacts?runId=${encodeURIComponent(run.id)}`)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      还没有运行记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={selectedRun ? `运行详情 · ${selectedRun.planName}` : "运行详情"}
          subtitle={selectedRun ? `开始于 ${formatDateTime(selectedRun.startedAt)}` : "选择左侧运行记录查看详情。"}
          actions={
            selectedRun ? (
              <div className="panel-toolbar">
                {selectedRun.taskId ? (
                  <Link
                    to={`/tasks?taskId=${encodeURIComponent(selectedRun.taskId)}`}
                    className="ghost-button"
                  >
                    查看任务
                  </Link>
                ) : null}
                {selectedRun.reportAvailable ? (
                  <a href="/report" target="_blank" rel="noreferrer" className="ghost-button">
                    打开报告
                  </a>
                ) : null}
              </div>
            ) : null
          }
        >
          {selectedRun ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>状态</span>
                  <strong>{statusLabel(selectedRun.status)}</strong>
                  <p>{selectedRun.summary}</p>
                </div>
                <div>
                  <span>最新阶段</span>
                  <strong>{selectedRun.latestStage?.stageLabel || "尚无阶段信息"}</strong>
                  <p>{selectedRun.latestStage?.details || "等待后续阶段输出。"}</p>
                </div>
                <div>
                  <span>浏览器环境</span>
                  <strong>
                    {selectedRun.browserEnvironmentSummary?.name || "未记录"}
                  </strong>
                  <p>
                    {selectedRun.browserEnvironmentSummary?.approvalStatus || "未回显审批状态"}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>值</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>站点</td>
                      <td>{selectedRun.siteName}</td>
                    </tr>
                    <tr>
                      <td>模式</td>
                      <td>{selectedRun.mode === "headed" ? "有头模式" : "无头模式"}</td>
                    </tr>
                    <tr>
                      <td>退出码</td>
                      <td>{selectedRun.exitCode ?? "—"}</td>
                    </tr>
                    <tr>
                      <td>完成时间</td>
                      <td>{formatDateTime(selectedRun.finishedAt || selectedRun.startedAt)}</td>
                    </tr>
                    <tr>
                      <td>关联任务</td>
                      <td>{selectedRun.taskId || "无"}</td>
                    </tr>
                    <tr>
                      <td>浏览器环境</td>
                      <td>
                        {selectedRun.browserEnvironmentSummary
                          ? `${selectedRun.browserEnvironmentSummary.name} / ${selectedRun.browserEnvironmentSummary.browserVersion}`
                          : "无"}
                      </td>
                    </tr>
                    <tr>
                      <td>环境来源 / 审批</td>
                      <td>
                        {selectedRun.browserEnvironmentSummary
                          ? `${selectedRun.browserEnvironmentSummary.sourceType} / ${selectedRun.browserEnvironmentSummary.approvalStatus}`
                          : "无"}
                      </td>
                    </tr>
                  </tbody>
                </table>
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

              {selectedRun.browserEnvironmentSummary ? (
                <article className="insight-panel tone-neutral">
                  <span>浏览器环境回显</span>
                  <strong>
                    {selectedRun.browserEnvironmentSummary.name} · {selectedRun.browserEnvironmentSummary.browserVersion}
                  </strong>
                  <p>
                    {selectedRun.browserEnvironmentSummary.locale} / {selectedRun.browserEnvironmentSummary.timezone}
                  </p>
                </article>
              ) : null}

              <div className="panel-toolbar panel-toolbar--split">
                <label className="inline-search">
                  <input
                    value={logSearch}
                    placeholder="搜索当前运行日志"
                    onChange={(event) =>
                      startTransition(() => {
                        setLogSearch(event.target.value);
                      })
                    }
                  />
                </label>
                <Link to={`/artifacts?runId=${encodeURIComponent(selectedRun.id)}`} className="ghost-button">
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
            </>
          ) : (
            <p className="empty-copy">启动一次运行后，这里会出现阶段、结论与日志。</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
