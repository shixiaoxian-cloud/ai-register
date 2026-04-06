import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { ActionIconButton } from "../components/ActionIconButton";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatArtifactType, formatBytes, formatDateTime } from "../lib/formatters";
import type { ArtifactEntry, CaseRecord, RunRecord, TaskRecord } from "../lib/types";

export function ArtifactsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [artifacts, setArtifacts] = useState<ArtifactEntry[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [artifactType, setArtifactType] = useState(searchParams.get("type") || "");
  const [runId, setRunId] = useState(searchParams.get("runId") || "");
  const [taskId, setTaskId] = useState(searchParams.get("taskId") || "");
  const [caseId, setCaseId] = useState(searchParams.get("caseId") || "");
  const [selectedArtifactId, setSelectedArtifactId] = useState(searchParams.get("artifactId") || "");
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
        setSelectedArtifactId((current) => {
          const preferredId = searchParams.get("artifactId") || current;
          return nextArtifacts.some((artifact) => artifact.id === preferredId)
            ? preferredId
            : nextArtifacts[0]?.id || "";
        });
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

  useEffect(() => {
    const params = new URLSearchParams();
    if (runId) {
      params.set("runId", runId);
    }
    if (taskId) {
      params.set("taskId", taskId);
    }
    if (caseId) {
      params.set("caseId", caseId);
    }
    if (artifactType) {
      params.set("type", artifactType);
    }
    if (selectedArtifactId) {
      params.set("artifactId", selectedArtifactId);
    }
    setSearchParams(params, { replace: true });
  }, [artifactType, runId, taskId, caseId, selectedArtifactId, setSearchParams]);

  const visibleArtifacts = artifacts.filter((artifact) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return `${artifact.name} ${artifact.relPath} ${artifact.type}`.toLowerCase().includes(query);
  });

  const summary = {
    report: artifacts.filter((artifact) => artifact.type === "report").length,
    token: artifacts.filter((artifact) => artifact.type === "token").length,
    media: artifacts.filter((artifact) => artifact.type === "media").length,
    trace: artifacts.filter((artifact) => artifact.type === "trace").length,
    log: artifacts.filter((artifact) => artifact.type === "log").length
  };

  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) || null;
  const selectedTask = tasks.find((task) => task.id === taskId) || null;
  const selectedRun = runs.find((run) => run.id === selectedArtifact?.runId) || null;
  const selectedCase = cases.find((caseRecord) => caseRecord.id === selectedArtifact?.caseId) || null;

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="产物中心"
        title="所有结果都回到标准资产台账"
        description="报告、截图、Trace、日志和令牌按统一列表管理。先筛选，再点开右侧看详情，不再用卡片瀑布刷文件。"
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
        subtitle="按运行、任务、批次和类型逐步收窄资产列表。"
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
        <div className="panel-toolbar panel-toolbar--split">
          <div className="filter-grid">
            <select value={runId} onChange={(event) => setRunId(event.target.value)}>
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
                setTaskId(event.target.value);
                setCaseId("");
              }}
            >
              <option value="">全部任务</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </select>
            <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
              <option value="">全部批次</option>
              {cases.map((caseItem) => (
                <option key={caseItem.id} value={caseItem.id}>
                  {caseItem.name}
                </option>
              ))}
            </select>
            <select value={artifactType} onChange={(event) => setArtifactType(event.target.value)}>
              <option value="">全部类型</option>
              <option value="report">报告</option>
              <option value="token">令牌</option>
              <option value="media">媒体</option>
              <option value="trace">追踪</option>
              <option value="log">日志</option>
            </select>
          </div>

          <label className="inline-search">
            <input
              value={search}
              placeholder="搜索文件名 / 路径 / 类型"
              onChange={(event) =>
                startTransition(() => {
                  setSearch(event.target.value);
                })
              }
            />
          </label>
        </div>
      </SectionCard>

      <div className="detail-layout">
        <SectionCard title="资产台账" subtitle="左侧列表统一展示元数据，操作列固定在右侧。">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>文件</th>
                  <th>关联</th>
                  <th>更新时间</th>
                  <th>大小</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleArtifacts.length ? (
                  visibleArtifacts.map((artifact) => (
                    <tr
                      key={artifact.id}
                      className={selectedArtifact?.id === artifact.id ? "is-selected" : undefined}
                      onClick={() => setSelectedArtifactId(artifact.id)}
                    >
                      <td>
                        <StatusPill tone={artifact.type === "token" ? "warning" : "neutral"}>
                          {formatArtifactType(artifact.type)}
                        </StatusPill>
                      </td>
                      <td>
                        <div className="table-primary">
                          <strong>{artifact.name}</strong>
                          <span>{artifact.relPath}</span>
                        </div>
                      </td>
                      <td>{artifact.runId || artifact.taskId || artifact.caseId || "未关联"}</td>
                      <td>{formatDateTime(artifact.modifiedAt)}</td>
                      <td>{formatBytes(artifact.sizeBytes)}</td>
                      <td>
                        <div className="table-actions">
                          <ActionIconButton icon="view" label="查看" tone="accent" onClick={() => setSelectedArtifactId(artifact.id)} />
                          <ActionIconButton icon="open" label="打开" href={artifact.href} target="_blank" rel="noreferrer" />
                          <ActionIconButton icon="download" label="下载" href={artifact.href} download />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      当前过滤条件下没有找到可展示的产物。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={selectedArtifact ? `资产详情 · ${selectedArtifact.name}` : "资产详情"}
          subtitle={selectedArtifact ? "右侧显示所选资产的归属、路径和操作入口。" : "选择左侧资产查看详情。"}
          actions={
            selectedArtifact ? (
              <div className="panel-toolbar">
                <ActionIconButton icon="open" label="打开" tone="accent" href={selectedArtifact.href} target="_blank" rel="noreferrer" />
                <ActionIconButton icon="download" label="下载" href={selectedArtifact.href} download />
              </div>
            ) : null
          }
        >
          {selectedArtifact ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>资产类型</span>
                  <strong>{formatArtifactType(selectedArtifact.type)}</strong>
                  <p>{selectedArtifact.relPath}</p>
                </div>
                <div>
                  <span>最近更新时间</span>
                  <strong>{formatDateTime(selectedArtifact.modifiedAt)}</strong>
                  <p>{formatBytes(selectedArtifact.sizeBytes)}</p>
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
                      <td>Bucket</td>
                      <td>{selectedArtifact.bucket}</td>
                    </tr>
                    <tr>
                      <td>相对路径</td>
                      <td>{selectedArtifact.relPath}</td>
                    </tr>
                    <tr>
                      <td>绝对路径</td>
                      <td>{selectedArtifact.absolutePath}</td>
                    </tr>
                    <tr>
                      <td>关联任务</td>
                      <td>{selectedArtifact.taskId || "无"}</td>
                    </tr>
                    <tr>
                      <td>关联批次</td>
                      <td>{selectedArtifact.caseId || "无"}</td>
                    </tr>
                    <tr>
                      <td>关联运行</td>
                      <td>{selectedArtifact.runId || "无"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="panel-toolbar panel-toolbar--split">
                <div className="panel-toolbar">
                  {selectedArtifact.taskId ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => navigate(`/tasks?taskId=${encodeURIComponent(selectedArtifact.taskId || "")}`)}
                    >
                      打开任务
                    </button>
                  ) : null}
                  {selectedArtifact.runId ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => navigate(`/runs?runId=${encodeURIComponent(selectedArtifact.runId || "")}`)}
                    >
                      打开运行
                    </button>
                  ) : null}
                </div>

                <div className="table-inline-note">
                  {selectedRun ? `运行：${selectedRun.planName}` : ""}
                  {selectedCase ? ` · 批次：${selectedCase.name}` : ""}
                </div>
              </div>
            </>
          ) : (
            <p className="empty-copy">选择一个产物后，这里会显示它的归属和操作入口。</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
