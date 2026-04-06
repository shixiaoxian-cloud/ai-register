import { useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import type { SystemSettings } from "../lib/types";

export function SystemPage() {
  const [system, setSystem] = useState<SystemSettings>({
    defaultRunMode: "headless",
    continueAfterProtectedChallenge: false,
    preferredLandingPage: "overview",
    notes: ""
  });
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
      setSuccess("系统偏好已更新。");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存系统设置失败。");
    }
  }

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="系统设置"
        title="让新版控制台成为唯一操作面"
        description="这里不再提供旧版回退路径，只保留新版控制台的默认运行偏好和平台说明。"
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard title="运行默认值" subtitle="这些值会成为平台运行的默认偏好。">
        <div className="form-grid">
          <label>
            默认运行模式
            <select
              value={system.defaultRunMode}
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

          <label>
            默认落点
            <select
              value={system.preferredLandingPage}
              onChange={(event) =>
                setSystem((current) => ({
                  ...current,
                  preferredLandingPage: event.target.value as SystemSettings["preferredLandingPage"]
                }))
              }
            >
              <option value="overview">总览</option>
              <option value="runs">运行中心</option>
              <option value="config">配置中心</option>
            </select>
          </label>
        </div>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={system.continueAfterProtectedChallenge}
            onChange={(event) =>
              setSystem((current) => ({
                ...current,
                continueAfterProtectedChallenge: event.target.checked
              }))
            }
          />
          默认允许人工完成挑战后继续执行
        </label>

        <label>
          平台说明
          <textarea
            rows={6}
            value={system.notes}
            onChange={(event) =>
              setSystem((current) => ({
                ...current,
                notes: event.target.value
              }))
            }
          />
        </label>

        <div className="toolbar-row">
          <button type="button" className="accent-button" onClick={handleSave}>
            保存系统设置
          </button>
        </div>
      </SectionCard>

      <SectionCard title="唯一入口策略" subtitle="新版控制台现在是唯一入口。">
        <div className="link-grid">
          <a href="/" className="focus-card">
            <span>当前平台入口</span>
            <strong>/</strong>
            <p>无论是资源管理、运行排查还是产物查看，都统一从这里进入。</p>
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
