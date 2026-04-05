import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatArtifactType, formatBytes, formatDateTime } from "../lib/formatters";
import type { ArtifactEntry, CaseRecord, RunRecord, TaskRecord } from "../lib/types";

export function ArtifactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [artifactType, setArtifactType] = useState(searchParams.get("type") || "");
  const [runId, setRunId] = useState(searchParams.get("runId") || "");
  const [taskId, setTaskId] = useState(searchParams.get("taskId") || "");
  const [caseId, setCaseId] = useState(searchParams.get("caseId") || "");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    async function loadArtifacts() {
      try {
        const [nextArtifacts, runPayload, nextTasks, nextCases] = await Promise.all([
          api.getArtifacts({ runId, taskId, caseId, type: artifactType }),
          api.getRuns(),
          api.getTasks(),
          api.getCases(taskId)
        ]);

        if (cancelled) {
          return;
        }

        setArtifacts(nextArtifacts);
        setRuns(runPayload.runs);
        setTasks(nextTasks);
        setCases(nextCases);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取产物中心失败。");
        }
      }
    }

    loadArtifacts();
    const timer = window.setInterval(loadArtifacts, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [artifactType, runId, taskId, caseId]);

  const visibleArtifacts = artifacts.filter((artifact) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return `${artifact.name} ${artifact.relPath}`.toLowerCase().includes(query);
  });

  const summary = {
    report: artifacts.filter((artifact) => artifact.type === "report").length,
    token: artifacts.filter((artifact) => artifact.type === "token").length,
    media: artifacts.filter((artifact) => artifact.type === "media").length,
    trace: artifacts.filter((artifact) => artifact.type === "trace").length,
    log: artifacts.filter((artifact) => artifact.type === "log").length
  };
  const selectedTask = tasks.find((task) => task.id === taskId) || null;

  function syncSearchParams(nextRunId: string, nextTaskId: string, nextCaseId: string, nextType: string) {
    const params = new URLSearchParams();
    if (nextRunId) {
      params.set("runId", nextRunId);
    }
    if (nextTaskId) {
      params.set("taskId", nextTaskId);
    }
    if (nextCaseId) {
      params.set("caseId", nextCaseId);
    }
    if (nextType) {
      params.set("type", nextType);
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="结果产物"
        title="把结果当成资产，而不只是附带文件"
        description="报告、截图、trace、日志和 token 都应该能跨运行浏览、按运行过滤、按类型定位。"
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}

      <div className="metrics-grid">
        <MetricCard label="报告" value={summary.report} detail="HTML 报告入口" tone="accent" />
        <MetricCard label="令牌" value={summary.token} detail="输出凭据与账号结果" tone="warning" />
        <MetricCard label="媒体" value={summary.media} detail="截图与录屏" tone="success" />
        <MetricCard label="追踪" value={summary.trace} detail="调试追踪归档" tone="neutral" />
        <MetricCard label="日志" value={summary.log} detail="日志与补充文件" tone="danger" />
      </div>

      <SectionCard
        title="筛选条件"
        subtitle="按运行或产物类型收窄视图。"
        actions={
          selectedTask ? (
            <a
              href={`/api/platform/tasks/${encodeURIComponent(selectedTask.id)}/download`}
              className="ghost-button"
            >
              下载任务包
            </a>
          ) : null
        }
      >
        <div className="toolbar-row">
          <select
            value={runId}
            onChange={(event) => {
              const nextRunId = event.target.value;
              setRunId(nextRunId);
              syncSearchParams(nextRunId, taskId, caseId, artifactType);
            }}
          >
            <option value="">全部运行</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.planName} · {formatDateTime(run.startedAt)}
              </option>
            ))}
          </select>

          <select
            value={taskId}
            onChange={(event) => {
              const nextTaskId = event.target.value;
              setTaskId(nextTaskId);
              setCaseId("");
              syncSearchParams(runId, nextTaskId, "", artifactType);
            }}
          >
            <option value="">全部任务</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>

          <select
            value={caseId}
            onChange={(event) => {
              const nextCaseId = event.target.value;
              setCaseId(nextCaseId);
              syncSearchParams(runId, taskId, nextCaseId, artifactType);
            }}
          >
            <option value="">全部用例</option>
            {cases.map((caseItem) => (
              <option key={caseItem.id} value={caseItem.id}>
                {caseItem.name}
              </option>
            ))}
          </select>

          <select
            value={artifactType}
            onChange={(event) => {
              const nextType = event.target.value;
              setArtifactType(nextType);
              syncSearchParams(runId, taskId, caseId, nextType);
            }}
          >
            <option value="">全部类型</option>
            <option value="report">报告</option>
            <option value="token">令牌</option>
            <option value="media">媒体</option>
            <option value="trace">追踪</option>
            <option value="log">日志</option>
          </select>

          <input
            className="search-input"
            placeholder="搜索文件名或路径…"
            value={search}
            onChange={(event) =>
              startTransition(() => {
                setSearch(event.target.value);
              })
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="产物库"
        subtitle={`${visibleArtifacts.length} 项结果产物可用`}
      >
        <div className="artifact-grid">
          {visibleArtifacts.length ? (
            visibleArtifacts.map((artifact) => (
              <article key={artifact.id} className="artifact-card">
                <div className="artifact-card__meta">
                  <StatusPill tone="neutral">{formatArtifactType(artifact.type)}</StatusPill>
                  {artifact.runId ? <StatusPill tone="accent">关联运行</StatusPill> : null}
                </div>
                <strong>{artifact.name}</strong>
                <p>{artifact.relPath}</p>
                <div className="artifact-card__foot">
                  <span>{formatDateTime(artifact.modifiedAt)}</span>
                  <span>{formatBytes(artifact.sizeBytes)}</span>
                </div>
                <a href={artifact.href} target="_blank" rel="noreferrer" className="ghost-button">
                  打开产物
                </a>
              </article>
            ))
          ) : (
            <p className="empty-copy">当前过滤条件下没有找到可展示的产物。</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
