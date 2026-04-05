import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime, formatRunStatus, toneForStatus } from "../lib/formatters";
import type { OverviewData } from "../lib/types";

export function OverviewPage() {
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

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="仪表盘"
        title="自动化测试平台控制台"
        description="参考后台管理台的信息架构，把品牌区、导航、顶栏、工具栏和数据卡片压进同一张浅色工作画布。"
        actions={
          <>
            <Link to="/config" className="accent-button">
              进入配置中心
            </Link>
            <Link to="/tasks" className="ghost-button">
              查看任务中心
            </Link>
          </>        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}

      <section className="console-toolbar">
        <label className="console-search">
          <span className="console-search__icon" aria-hidden="true" />
          <input
            aria-label="搜索最近运行"
            placeholder="搜索站点 / 方案 / 状态 / 阶段"
            value={search}
            onChange={(event) =>
              startTransition(() => {
                setSearch(event.target.value);
              })
            }
          />
        </label>
        <div className="toolbar-row">
          <Link to="/artifacts" className="ghost-button">
            产物中心
          </Link>
          <a href="/report" target="_blank" rel="noreferrer" className="ghost-button">
            最新报告
          </a>
          <Link to="/config" className="accent-button">
            新建资源
          </Link>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="站点资源"
          value={overview?.summary.siteCount ?? "—"}
          detail={`${overview?.summary.readySites ?? 0} 个站点已就绪`}
          tone="accent"
        />
        <MetricCard
          label="测试方案"
          value={overview?.summary.planCount ?? "—"}
          detail={`${overview?.summary.profileCount ?? 0} 个画像配置`}
          tone="success"
        />
        <MetricCard
          label="邮箱配置"
          value={overview?.summary.mailConfigCount ?? "—"}
          detail={`${overview?.summary.readyMailConfigs ?? 0} 个邮箱链路可用`}
          tone="neutral"
        />
        <MetricCard
          label="产物总数"
          value={overview?.summary.artifactCount ?? "—"}
          detail={`${overview?.summary.reportCount ?? 0} 份报告 / ${overview?.summary.tokenCount ?? 0} 份 token`}
          tone="warning"
        />
        <MetricCard
          label="异常运行"
          value={overview?.summary.failedRuns ?? "—"}
          detail={`当前活跃状态：${formatRunStatus(overview?.summary.activeRunStatus ?? "idle")}`}
          tone="danger"
        />
      </div>

      <div className="split-layout">
        <SectionCard
          title="平台健康度"
          subtitle="把平台是否可跑、可配、可追踪压缩成几个可读状态。"
        >
          <div className="health-grid">
            {overview?.health.map((item) => (
              <article key={item.id} className="health-card">
                <StatusPill tone={item.tone}>{item.label}</StatusPill>
                <p>{item.detail}</p>
              </article>
            )) ?? <p className="empty-copy">概览数据加载中…</p>}
          </div>
        </SectionCard>

        <SectionCard
          title="当前焦点资源"
          subtitle="始终把当前主要站点和方案放在第一屏，方便你立刻进入下一步。"
        >
          <div className="focus-stack">
            <div className="focus-card">
              <span>站点</span>
              <strong>{overview?.featuredSite?.name || "未选择站点"}</strong>
              <p>{overview?.featuredSite?.startUrl || "当前还没有有效目标地址。"}</p>
            </div>
            <div className="focus-card">
              <span>方案</span>
              <strong>{overview?.featuredPlan?.name || "未选择方案"}</strong>
              <p>{overview?.featuredPlan?.description || "还没有可复用测试方案。"}</p>
            </div>
            <div className="focus-card">
              <span>系统偏好</span>
              <strong>{overview?.system.defaultRunMode === "headed" ? "默认有头模式" : "默认无头模式"}</strong>
              <p>
                {overview?.system.continueAfterProtectedChallenge
                  ? "已允许人工续跑。"
                  : "当前默认不启用人工续跑。"}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="最近运行"
        subtitle="把执行记录整理成后台列表视图，在同一块卡片里比较方案、站点、阶段、状态和结论。"
        actions={<Link to="/tasks" className="ghost-button">查看全部任务</Link>}
      >
        <div className="table-panel">
          <div className="table-panel__header table-panel__header--runs">
            <span>方案 / 站点</span>
            <span>阶段</span>
            <span>状态</span>
            <span>更新时间</span>
            <span>结论</span>
          </div>

          <div className="table-panel__body">
            {visibleRuns.length ? (
              visibleRuns.map((run) => (
                <article key={run.id} className="table-row table-row--runs">
                  <div className="table-row__primary">
                    <strong>{run.planName}</strong>
                    <p>
                      {run.siteName} · {formatDateTime(run.startedAt)}
                    </p>
                  </div>
                  <div className="table-row__secondary">
                    <span className="run-row__label">最新阶段</span>
                    <p>{run.latestStage?.stageLabel || "尚无阶段信息"}</p>
                  </div>
                  <div className="table-row__status">
                    <StatusPill tone={toneForStatus(run.status)}>
                      {formatRunStatus(run.status)}
                    </StatusPill>
                  </div>
                  <div className="table-row__secondary">
                    <span className="run-row__label">最近时间</span>
                    <p>{formatDateTime(run.finishedAt || run.startedAt)}</p>
                  </div>
                  <div className="table-row__secondary">
                    <span className="run-row__label">运行结论</span>
                    <p>{run.conclusion?.summary || run.summary}</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-copy">当前条件下没有找到运行记录。</p>
            )}
          </div>

          <div className="table-panel__footer">
            <span>
              显示 1 至 {visibleRuns.length} 共 {recentRuns.length} 条记录
            </span>
            <Link to="/tasks" className="ghost-button">
              打开任务中心
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="操作路径"
        subtitle={`最后更新时间：${formatDateTime(overview?.updatedAt)}`}
      >
        <div className="operator-rail">
          <div className="operator-step">
            <span>01</span>
            <strong>配置站点与方案</strong>
            <p>在配置中心管理目标站点、画像、邮箱和可复用测试方案。</p>
          </div>
          <div className="operator-step">
            <span>02</span>
            <strong>发起任务并盯进度</strong>
            <p>在任务中心观察每次执行的进度、人工介入提示和关键日志。</p>
          </div>
          <div className="operator-step">
            <span>03</span>
            <strong>沉淀结果产物</strong>
            <p>在产物中心按运行追踪报告、Trace、媒体和 Token 输出。</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
