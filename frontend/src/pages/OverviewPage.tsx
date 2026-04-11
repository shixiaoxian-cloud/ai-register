import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ActionIconButton } from "../components/ActionIconButton";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime, formatRunStatus, toneForStatus } from "../lib/formatters";
import type { OverviewData } from "../lib/types";

interface ResourceLedgerRow {
  id: string;
  label: string;
  title: string;
  detail: string;
  route: string;
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        const nextOverview = await api.getOverview();
        if (!cancelled) {
          setOverview(nextOverview);
          setMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取平台概览失败。");
        }
      }
    }

    loadOverview();
    const timer = window.setInterval(loadOverview, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const recentRuns = overview?.recentRuns || [];
  const visibleRuns = recentRuns.filter((run) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [
      run.planName,
      run.siteName,
      run.status,
      run.latestStage?.stageLabel,
      run.summary,
      run.conclusion?.summary
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const resourceLedger: ResourceLedgerRow[] = [
    {
      id: "site",
      label: "当前站点",
      title: overview?.featuredSite?.name || "未选择站点",
      detail: overview?.featuredSite?.startUrl || "还没有有效目标地址。",
      route: "/config"
    },
    {
      id: "plan",
      label: "当前方案",
      title: overview?.featuredPlan?.name || "未选择方案",
      detail: overview?.featuredPlan?.description || "还没有可复用测试方案。",
      route: "/config"
    },
    {
      id: "system",
      label: "系统默认值",
      title: overview?.system.defaultRunMode === "headed" ? "默认有头模式" : "默认无头模式",
      detail: overview?.system.continueAfterProtectedChallenge
        ? "已允许人工完成挑战后继续续跑。"
        : "当前默认不启用人工续跑。",
      route: "/system"
    }
  ];

  const healthRoutes: Record<string, string> = {
    sites: "/config",
    plans: "/config",
    "browser-environments": "/config",
    mail: "/config",
    runs: "/runs"
  };

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="总览"
        title="统一台账式自动化控制台"
        description="把资源、任务、运行和产物都收束到统一的列表后台里。第一屏先看异常、看当前焦点，再决定进入配置、任务还是运行流水。"
        actions={
          <>
            <Link to="/config" className="ghost-button">
              打开配置中心
            </Link>
            <Link to="/tasks" className="accent-button">
              打开任务中心
            </Link>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}

      <div className="overview-grid">
        <div className="overview-grid__main">
          <div className="metrics-grid">
            <MetricCard
              label="站点"
              value={overview?.summary.siteCount ?? "—"}
              detail={`${overview?.summary.readySites ?? 0} 个已就绪`}
              tone="accent"
            />
            <MetricCard
              label="方案"
              value={overview?.summary.planCount ?? "—"}
              detail={`${overview?.summary.profileCount ?? 0} 个画像可复用`}
              tone="success"
            />
            <MetricCard
              label="邮箱"
              value={overview?.summary.mailConfigCount ?? "—"}
              detail={`${overview?.summary.readyMailConfigs ?? 0} 个链路可用`}
              tone="neutral"
            />
            <MetricCard
              label="浏览器环境"
              value={overview?.summary.browserEnvironmentConfigCount ?? "—"}
              detail={`${overview?.summary.approvedBrowserEnvironments ?? 0} 套已批准`}
              tone="success"
            />
            <MetricCard
              label="产物"
              value={overview?.summary.artifactCount ?? "—"}
              detail={`${overview?.summary.reportCount ?? 0} 份报告 / ${overview?.summary.tokenCount ?? 0} 份令牌`}
              tone="warning"
            />
            <MetricCard
              label="异常运行"
              value={overview?.summary.failedRuns ?? "—"}
              detail={`当前活跃：${formatRunStatus(overview?.summary.activeRunStatus ?? "idle")}`}
              tone="danger"
            />
          </div>

          <SectionCard
            title="最近运行台账"
            subtitle="按统一表格查看最近的运行结果，直接跳转到运行流水、任务中心或产物中心。"
            actions={
              <label className="inline-search">
                <input
                  aria-label="搜索最近运行"
                  placeholder="搜索方案 / 站点 / 状态 / 阶段"
                  value={search}
                  onChange={(event) =>
                    startTransition(() => {
                      setSearch(event.target.value);
                    })
                  }
                />
              </label>
            }
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>方案</th>
                    <th>站点</th>
                    <th>最新阶段</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>结论</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.length ? (
                    visibleRuns.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <div className="table-primary">
                            <strong>{run.planName}</strong>
                          </div>
                        </td>
                        <td>{run.siteName}</td>
                        <td>{run.latestStage?.stageLabel || "尚无阶段信息"}</td>
                        <td>
                          <StatusPill tone={toneForStatus(run.status)}>
                            {formatRunStatus(run.status)}
                          </StatusPill>
                        </td>
                        <td>{formatDateTime(run.finishedAt || run.startedAt)}</td>
                        <td>{run.conclusion?.summary || run.summary}</td>
                        <td>
                          <div className="table-actions">
                            <ActionIconButton
                              icon="view"
                              label="查看运行"
                              tone="accent"
                              onClick={() => navigate(`/runs?runId=${encodeURIComponent(run.id)}`)}
                            />
                            {run.taskId ? (
                              <ActionIconButton
                                icon="logs"
                                label="查看任务"
                                onClick={() =>
                                  navigate(`/tasks?taskId=${encodeURIComponent(run.taskId || "")}`)
                                }
                              />
                            ) : null}
                            <ActionIconButton
                              icon="open"
                              label="查看产物"
                              onClick={() =>
                                navigate(`/artifacts?runId=${encodeURIComponent(run.id)}`)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        当前条件下没有找到运行记录。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="overview-grid__side">
          <SectionCard
            title="平台健康清单"
            subtitle="把站点、方案、邮箱和运行状态放到一张台账里，看清楚哪里还没准备好。"
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>模块</th>
                    <th>状态</th>
                    <th>说明</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overview?.health.length ? (
                    overview.health.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-primary">
                            <strong>{item.label}</strong>
                          </div>
                        </td>
                        <td>
                          <StatusPill tone={item.tone}>{item.label}</StatusPill>
                        </td>
                        <td>{item.detail}</td>
                        <td>
                          <div className="table-actions">
                            <ActionIconButton
                              icon="view"
                              label="查看"
                              tone="accent"
                              onClick={() => navigate(healthRoutes[item.id] || "/")}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        概览数据加载中…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="当前资源焦点"
            subtitle="这里固定显示当前主要站点、方案和系统默认值，方便快速跳转。"
          >
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>当前值</th>
                    <th>说明</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceLedger.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.label}</td>
                      <td>
                        <div className="table-primary">
                          <strong>{entry.title}</strong>
                        </div>
                      </td>
                      <td>{entry.detail}</td>
                      <td>
                        <div className="table-actions">
                          <ActionIconButton
                            icon="view"
                            label="查看"
                            tone="accent"
                            onClick={() => navigate(entry.route)}
                          />
                          <ActionIconButton
                            icon="edit"
                            label="修改"
                            onClick={() => navigate(entry.route)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="操作清单"
            subtitle={`最后更新时间：${formatDateTime(overview?.updatedAt)}`}
          >
            <ol className="workflow-list">
              <li>先在配置中心维护站点、方案、画像和邮箱资源，保证资源处于可运行状态。</li>
              <li>进入任务中心按任务视角发起批量执行，再通过运行流水盯具体阶段和人工介入点。</li>
              <li>最后到产物中心回收报告、Trace、日志和令牌，形成可下载的任务归档。</li>
            </ol>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
