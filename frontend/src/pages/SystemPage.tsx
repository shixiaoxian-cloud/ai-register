import { useEffect, useState } from "react";

import { ActionIconButton } from "../components/ActionIconButton";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import type { SystemSettings } from "../lib/types";

type SystemSection = "runtime" | "landing" | "notes" | "entry";
type DetailMode = "view" | "edit";

function landingLabel(value: SystemSettings["preferredLandingPage"]) {
  switch (value) {
    case "runs":
      return "运行流水";
    case "config":
      return "配置中心";
    default:
      return "总览";
  }
}

export function SystemPage() {
  const [system, setSystem] = useState<SystemSettings>({
    defaultRunMode: "headless",
    continueAfterProtectedChallenge: false,
    preferredLandingPage: "overview",
    notes: ""
  });
  const [selectedSection, setSelectedSection] = useState<SystemSection>("runtime");
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSystem() {
      try {
        const nextSystem = await api.getSystem();
        if (!cancelled) {
          setSystem(nextSystem);
          setMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取系统设置失败。");
        }
      }
    }

    loadSystem();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    try {
      const nextSystem = await api.updateSystem(system);
      setSystem(nextSystem);
      setDetailMode("view");
      setSuccess("系统偏好已更新。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存系统设置失败。");
    }
  }

  const rows: Array<{
    id: SystemSection;
    label: string;
    summary: string;
    detail: string;
    editable: boolean;
  }> = [
    {
      id: "runtime",
      label: "运行默认值",
      summary: system.defaultRunMode === "headed" ? "默认有头模式" : "默认无头模式",
      detail: system.continueAfterProtectedChallenge ? "已允许人工续跑" : "当前默认不启用人工续跑",
      editable: true
    },
    {
      id: "landing",
      label: "默认落点",
      summary: landingLabel(system.preferredLandingPage),
      detail: "控制进入新版控制台后的默认页面",
      editable: true
    },
    {
      id: "notes",
      label: "平台说明",
      summary: system.notes ? "已填写说明" : "未填写说明",
      detail: system.notes || "这里用于记录本地控制台的说明和约束。",
      editable: true
    },
    {
      id: "entry",
      label: "入口策略",
      summary: "新版控制台唯一入口",
      detail: "旧版页面不再作为受支持入口保留。",
      editable: false
    }
  ];

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="系统设置"
        title="系统页也回到标准设置台账"
        description="系统设置不再散成几块卡片，而是统一成设置项列表。左侧看设置类别，右侧看详情和编辑。"
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <div className="detail-layout">
        <SectionCard title="设置项台账" subtitle="每个设置项都能在列表中查看和切换到修改模式。">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>设置项</th>
                  <th>当前值</th>
                  <th>说明</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={selectedSection === row.id ? "is-selected" : undefined}
                    onClick={() => {
                      setSelectedSection(row.id);
                      setDetailMode("view");
                    }}
                  >
                    <td>{row.label}</td>
                    <td>
                      <div className="table-primary">
                        <strong>{row.summary}</strong>
                      </div>
                    </td>
                    <td>{row.detail}</td>
                    <td>
                      <div className="table-actions">
                        <ActionIconButton icon="view" label="查看" tone="accent" onClick={() => { setSelectedSection(row.id); setDetailMode("view"); }} />
                        {row.editable ? (
                          <ActionIconButton icon="edit" label="修改" onClick={() => { setSelectedSection(row.id); setDetailMode("edit"); }} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={rows.find((row) => row.id === selectedSection)?.label || "设置详情"}
          subtitle="右侧统一承担查看和修改。不可编辑项只展示说明，不提供保存。"
          actions={
            <div className="panel-toolbar">
              <StatusPill tone={detailMode === "edit" ? "accent" : "neutral"}>
                {detailMode === "edit" ? "修改模式" : "查看模式"}
              </StatusPill>
              {rows.find((row) => row.id === selectedSection)?.editable && detailMode === "view" ? (
                <button type="button" className="ghost-button" onClick={() => setDetailMode("edit")}>
                  切换到修改
                </button>
              ) : null}
            </div>
          }
        >
          {selectedSection === "runtime" ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>默认运行模式</span>
                  <strong>{system.defaultRunMode === "headed" ? "有头模式" : "无头模式"}</strong>
                  <p>任务页和运行页都会读取这里的默认值。</p>
                </div>
                <div>
                  <span>人工续跑</span>
                  <strong>{system.continueAfterProtectedChallenge ? "已开启" : "未开启"}</strong>
                  <p>决定是否允许人工完成挑战后继续执行。</p>
                </div>
              </div>
              <div className="form-grid compact-grid">
                <label>
                  默认运行模式
                  <select
                    value={system.defaultRunMode}
                    disabled={detailMode !== "edit"}
                    onChange={(event) =>
                      setSystem((current) => ({
                        ...current,
                        defaultRunMode: event.target.value as SystemSettings["defaultRunMode"]
                      }))
                    }
                  >
                    <option value="headless">无头模式</option>
                    <option value="headed">有头模式</option>
                  </select>
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={system.continueAfterProtectedChallenge}
                  disabled={detailMode !== "edit"}
                  onChange={(event) =>
                    setSystem((current) => ({
                      ...current,
                      continueAfterProtectedChallenge: event.target.checked
                    }))
                  }
                />
                默认允许人工完成挑战后继续执行
              </label>
            </>
          ) : null}

          {selectedSection === "landing" ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>默认落点</span>
                  <strong>{landingLabel(system.preferredLandingPage)}</strong>
                  <p>控制进入新版控制台后默认看到哪个页面。</p>
                </div>
              </div>
              <div className="form-grid compact-grid">
                <label>
                  默认落点
                  <select
                    value={system.preferredLandingPage}
                    disabled={detailMode !== "edit"}
                    onChange={(event) =>
                      setSystem((current) => ({
                        ...current,
                        preferredLandingPage: event.target.value as SystemSettings["preferredLandingPage"]
                      }))
                    }
                  >
                    <option value="overview">总览</option>
                    <option value="runs">运行流水</option>
                    <option value="config">配置中心</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}

          {selectedSection === "notes" ? (
            <>
              <div className="detail-summary">
                <div>
                  <span>平台说明</span>
                  <strong>{system.notes ? "已填写说明" : "未填写说明"}</strong>
                  <p>用于记录本地平台的说明、约束和注意事项。</p>
                </div>
              </div>
              <label>
                平台说明
                <textarea
                  rows={8}
                  value={system.notes}
                  disabled={detailMode !== "edit"}
                  onChange={(event) =>
                    setSystem((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          {selectedSection === "entry" ? (
            <div className="detail-summary">
              <div>
                <span>唯一入口策略</span>
                <strong>/</strong>
                <p>新版控制台现在是唯一入口，旧版页面不再作为受支持路径保留。</p>
              </div>
            </div>
          ) : null}

          <div className="form-footer">
            {rows.find((row) => row.id === selectedSection)?.editable ? (
              detailMode === "edit" ? (
                <button type="button" className="accent-button" onClick={handleSave}>
                  保存系统设置
                </button>
              ) : (
                <p className="empty-copy">查看模式下不允许修改字段。点击“切换到修改”后再保存。</p>
              )
            ) : (
              <p className="empty-copy">该项为说明性设置，不提供保存操作。</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
