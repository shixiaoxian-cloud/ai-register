import { startTransition, useEffect, useState } from "react";

import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatters";
import type {
  MailConfigResource,
  PlanResource,
  PlatformState,
  ProfileResource,
  ReadinessMap,
  SiteResource
} from "../lib/types";

type ConfigTab = "sites" | "plans" | "profiles" | "mail";

interface ProfileEditorState {
  id?: string;
  name: string;
  description: string;
  expectedOutcomesText: string;
  grantedPermissionsText: string;
  selectorsText: string;
  mailbox: string;
  senderFilter: string;
  subjectFilter: string;
  codePattern: string;
  enabled: boolean;
}

interface SelectionOverrides {
  siteId?: string;
  planId?: string;
  profileId?: string;
  mailConfigId?: string;
}

function emptySiteDraft(): SiteResource {
  return {
    name: "",
    description: "",
    startUrl: ""
  };
}

function emptyPlanDraft(fallbacks: {
  siteId?: string;
  profileId?: string;
  mailConfigId?: string;
}): PlanResource {
  return {
    name: "",
    description: "",
    siteId: fallbacks.siteId || "",
    profileId: fallbacks.profileId || "",
    mailConfigId: fallbacks.mailConfigId || "",
    runMode: "headless",
    continueAfterProtectedChallenge: false
  };
}

function emptyMailDraft(): MailConfigResource {
  return {
    name: "",
    description: "",
    mode: "temp-mail",
    enabled: true,
    baseUrl: "",
    apiKey: "",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    imapUser: "",
    imapPass: ""
  };
}

function profileToEditor(profile?: ProfileResource): ProfileEditorState {
  return {
    id: profile?.id,
    name: profile?.name || "",
    description: profile?.description || "",
    expectedOutcomesText: (profile?.expectedOutcomes || []).join(", "),
    grantedPermissionsText: (profile?.grantedPermissions || []).join(", "),
    selectorsText: JSON.stringify(profile?.selectors || {}, null, 2),
    mailbox: profile?.emailVerification.mailbox || "INBOX",
    senderFilter:
      profile?.emailVerification.senderFilter ||
      profile?.emailVerification.fromIncludes ||
      "",
    subjectFilter:
      profile?.emailVerification.subjectFilter ||
      profile?.emailVerification.subjectIncludes ||
      "",
    codePattern: profile?.emailVerification.codePattern || "\\b(\\d{6})\\b",
    enabled: profile?.emailVerification.enabled ?? true
  };
}

function editorToProfile(editor: ProfileEditorState): ProfileResource {
  return {
    id: editor.id,
    name: editor.name,
    description: editor.description,
    expectedOutcomes: editor.expectedOutcomesText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    grantedPermissions: editor.grantedPermissionsText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    selectors: JSON.parse(editor.selectorsText || "{}") as Record<string, string>,
    emailVerification: {
      enabled: editor.enabled,
      mailbox: editor.mailbox,
      fromIncludes: editor.senderFilter,
      subjectIncludes: editor.subjectFilter,
      senderFilter: editor.senderFilter,
      subjectFilter: editor.subjectFilter,
      codePattern: editor.codePattern
    }
  };
}

function activeItem<T extends { id?: string }>(items: T[], selectedId: string) {
  return items.find((item) => item.id === selectedId);
}

function resolveSelection<T extends { id?: string }>(
  items: T[],
  preferredId: string | undefined,
  fallbackId: string | undefined
) {
  if (preferredId && items.some((item) => item.id === preferredId)) {
    return preferredId;
  }

  if (fallbackId && items.some((item) => item.id === fallbackId)) {
    return fallbackId;
  }

  return items[0]?.id || "";
}

function summarizePlanNames(plans: PlanResource[]) {
  if (!plans.length) {
    return "暂无关联方案";
  }

  return plans
    .slice(0, 3)
    .map((plan) => plan.name || "未命名方案")
    .join("、");
}

export function ConfigCenterPage() {
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [readiness, setReadiness] = useState<ReadinessMap | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sites");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedMailConfigId, setSelectedMailConfigId] = useState("");
  const [siteDraft, setSiteDraft] = useState<SiteResource>(emptySiteDraft());
  const [planDraft, setPlanDraft] = useState<PlanResource>(emptyPlanDraft({}));
  const [profileDraft, setProfileDraft] = useState<ProfileEditorState>(profileToEditor());
  const [mailDraft, setMailDraft] = useState<MailConfigResource>(emptyMailDraft());
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const plansBySiteId = (platformState?.plans || []).reduce<Record<string, PlanResource[]>>(
    (accumulator, plan) => {
      const siteId = plan.siteId || "";
      if (!siteId) {
        return accumulator;
      }

      accumulator[siteId] = accumulator[siteId] || [];
      accumulator[siteId].push(plan);
      return accumulator;
    },
    {}
  );
  const selectedSitePlans = siteDraft.id ? plansBySiteId[siteDraft.id] || [] : [];
  const siteStatusTone = siteDraft.startUrl ? "success" : "warning";
  const siteStatusLabel = siteDraft.startUrl ? "可运行" : "待补充地址";
  const canDeleteSite = Boolean(siteDraft.id) && selectedSitePlans.length === 0;

  function applyLoadedState(
    nextState: {
      state: PlatformState;
      readiness: ReadinessMap;
    },
    overrides: SelectionOverrides = {}
  ) {
    setPlatformState(nextState.state);
    setReadiness(nextState.readiness);
    setSelectedSiteId((current) =>
      resolveSelection(nextState.state.sites, overrides.siteId ?? current, nextState.state.selectedSiteId)
    );
    setSelectedPlanId((current) =>
      resolveSelection(nextState.state.plans, overrides.planId ?? current, nextState.state.selectedPlanId)
    );
    setSelectedProfileId((current) =>
      resolveSelection(
        nextState.state.profiles,
        overrides.profileId ?? current,
        nextState.state.selectedProfileId
      )
    );
    setSelectedMailConfigId((current) =>
      resolveSelection(
        nextState.state.mailConfigs,
        overrides.mailConfigId ?? current,
        nextState.state.selectedMailConfigId
      )
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const nextState = await api.getState();
        if (cancelled) {
          return;
        }

        applyLoadedState(nextState);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "读取配置中心失败。");
        }
      }
    }

    loadState();
    const timer = window.setInterval(loadState, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const selectedSite = platformState ? activeItem(platformState.sites, selectedSiteId) : null;
    if (selectedSite) {
      setSiteDraft(selectedSite);
      return;
    }

    setSiteDraft(emptySiteDraft());
  }, [platformState, selectedSiteId]);

  useEffect(() => {
    const selectedPlan = platformState ? activeItem(platformState.plans, selectedPlanId) : null;
    if (selectedPlan) {
      setPlanDraft(selectedPlan);
      return;
    }

    setPlanDraft(
      emptyPlanDraft({
        siteId: platformState?.selectedSiteId || platformState?.sites[0]?.id,
        profileId: platformState?.selectedProfileId || platformState?.profiles[0]?.id,
        mailConfigId: platformState?.selectedMailConfigId || platformState?.mailConfigs[0]?.id
      })
    );
  }, [platformState, selectedPlanId]);

  useEffect(() => {
    const selectedProfile = platformState
      ? activeItem(platformState.profiles, selectedProfileId)
      : null;
    if (selectedProfile) {
      setProfileDraft(profileToEditor(selectedProfile));
      return;
    }

    setProfileDraft(profileToEditor());
  }, [platformState, selectedProfileId]);

  useEffect(() => {
    const selectedMailConfig = platformState
      ? activeItem(platformState.mailConfigs, selectedMailConfigId)
      : null;
    if (selectedMailConfig) {
      setMailDraft(selectedMailConfig);
      return;
    }

    setMailDraft(emptyMailDraft());
  }, [platformState, selectedMailConfigId]);

  async function reloadState(overrides: SelectionOverrides = {}) {
    const nextState = await api.getState();
    applyLoadedState(nextState, overrides);
    return nextState.state;
  }

  async function handleSiteSave() {
    try {
      const savedSite = await api.saveSite(siteDraft);
      const nextState = await reloadState({ siteId: savedSite.id || "" });
      setSelectedSiteId(savedSite.id || nextState.selectedSiteId);
      setSuccess("站点资源已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存站点失败。");
    }
  }

  async function handleSiteDelete() {
    try {
      if (!siteDraft.id) {
        throw new Error("请先选择一个已保存的站点。");
      }

      if (selectedSitePlans.length) {
        throw new Error(
          `当前站点仍关联 ${selectedSitePlans.length} 个方案，请先调整这些方案：${summarizePlanNames(selectedSitePlans)}`
        );
      }

      const confirmed = window.confirm(
        `确认删除站点“${siteDraft.name || "未命名站点"}”吗？此操作不可撤销。`
      );
      if (!confirmed) {
        return;
      }

      const deletedSite = await api.deleteSite(siteDraft.id);
      await reloadState({ siteId: "" });
      setSuccess(`站点资源“${deletedSite.name || "未命名站点"}”已删除。`);
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "删除站点失败。");
    }
  }

  async function handlePlanSave() {
    try {
      const savedPlan = await api.savePlan(planDraft);
      const nextState = await reloadState({ planId: savedPlan.id || "" });
      setSelectedPlanId(savedPlan.id || nextState.selectedPlanId);
      setSuccess("测试方案已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存方案失败。");
    }
  }

  async function handleProfileSave() {
    try {
      const savedProfile = await api.saveProfile(editorToProfile(profileDraft));
      const nextState = await reloadState({ profileId: savedProfile.id || "" });
      setSelectedProfileId(savedProfile.id || nextState.selectedProfileId);
      setSuccess("画像配置已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存画像失败，请检查 JSON 或规则格式。");
    }
  }

  async function handleMailSave() {
    try {
      const savedMail = await api.saveMailConfig(mailDraft);
      const nextState = await reloadState({ mailConfigId: savedMail.id || "" });
      setSelectedMailConfigId(savedMail.id || nextState.selectedMailConfigId);
      setSuccess("邮箱配置已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存邮箱配置失败。");
    }
  }

  async function handleMailTest() {
    try {
      if (!mailDraft.id) {
        throw new Error("请先保存邮箱配置，再执行连接测试。");
      }

      const result = await api.testMailConfig(mailDraft.id);
      setSuccess(result.testEmail ? `${result.message} 测试邮箱：${result.testEmail}` : result.message);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试邮箱连接失败。");
    }
  }

  const tabButtons: Array<{ id: ConfigTab; label: string }> = [
    { id: "sites", label: "站点" },
    { id: "plans", label: "方案" },
    { id: "profiles", label: "画像" },
    { id: "mail", label: "邮箱" }
  ];

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="配置中心"
        title="站点、方案与画像在这里汇流"
        description="把原来单一的目标站点配置演进为平台资源。先定义站点，再定义方案，再把画像和邮箱策略接上去。"
        actions={
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              startTransition(() => {
                setSuccess("");
                setMessage("");
              })
            }
          >
            清空提示
          </button>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard
        title="资源导航"
        subtitle="先选择当前要编辑的资源，再在右侧做深度调整。"
      >
        <div className="tab-row">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "tab-button is-active" : "tab-button"}
              onClick={() =>
                startTransition(() => {
                  setActiveTab(tab.id);
                  setSuccess("");
                  setMessage("");
                })
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="editor-layout">
        {activeTab === "sites" ? (
          <>
            <SectionCard
              title="站点列表"
              subtitle="一个站点代表一个被授权测试的目标站点。"
              actions={
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setSelectedSiteId("");
                    setSiteDraft(emptySiteDraft());
                    setSuccess("");
                    setMessage("");
                  }}
                >
                  新建站点
                </button>
              }
            >
              <div className="resource-list">
                {platformState?.sites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    className={selectedSiteId === site.id ? "resource-chip is-active" : "resource-chip"}
                    onClick={() => setSelectedSiteId(site.id || "")}
                  >
                    <strong>{site.name}</strong>
                    <span>{site.startUrl || "未配置地址"}</span>
                    <small>{(plansBySiteId[site.id || ""] || []).length} 个关联方案</small>
                  </button>
                )) || <p className="empty-copy">暂无站点资源。</p>}
              </div>
            </SectionCard>

            <SectionCard title="站点编辑器" subtitle={`更新时间：${formatDateTime(siteDraft.updatedAt)}`}>
              <div className="mini-card-grid">
                <div className="mini-card">
                  <span>站点状态</span>
                  <StatusPill tone={siteStatusTone}>{siteStatusLabel}</StatusPill>
                </div>
                <div className="mini-card">
                  <span>关联方案</span>
                  <strong>{selectedSitePlans.length}</strong>
                  <p>{summarizePlanNames(selectedSitePlans)}</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  站点名称
                  <input
                    value={siteDraft.name}
                    onChange={(event) =>
                      setSiteDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  目标地址
                  <input
                    value={siteDraft.startUrl}
                    onChange={(event) =>
                      setSiteDraft((current) => ({ ...current, startUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                描述
                <textarea
                  rows={5}
                  value={siteDraft.description}
                  onChange={(event) =>
                    setSiteDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <p className="empty-copy">
                站点删除前需要先解除所有方案关联。当前{selectedSitePlans.length
                  ? `已关联 ${selectedSitePlans.length} 个方案`
                  : "没有方案依赖"}。
              </p>
              <div className="toolbar-row">
                <button type="button" className="accent-button" onClick={handleSiteSave}>
                  保存站点
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleSiteDelete}
                  disabled={!canDeleteSite}
                >
                  删除站点
                </button>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === "plans" ? (
          <>
            <SectionCard
              title="方案列表"
              subtitle="一个站点可以有多套测试方案，用来验证不同流程或不同运行偏好。"
              actions={
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    setPlanDraft(
                      emptyPlanDraft({
                        siteId: platformState?.selectedSiteId,
                        profileId: platformState?.selectedProfileId,
                        mailConfigId: platformState?.selectedMailConfigId
                      })
                    )
                  }
                >
                  新建方案
                </button>
              }
            >
              <div className="resource-list">
                {platformState?.plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={selectedPlanId === plan.id ? "resource-chip is-active" : "resource-chip"}
                    onClick={() => setSelectedPlanId(plan.id || "")}
                  >
                    <strong>{plan.name}</strong>
                    <span>{plan.description || "未填写方案说明"}</span>
                  </button>
                )) || <p className="empty-copy">暂无测试方案。</p>}
              </div>
            </SectionCard>

            <SectionCard title="方案编辑器" subtitle={`更新时间：${formatDateTime(planDraft.updatedAt)}`}>
              <div className="form-grid">
                <label>
                  方案名称
                  <input
                    value={planDraft.name}
                    onChange={(event) =>
                      setPlanDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  默认运行模式
                  <select
                    value={planDraft.runMode}
                    onChange={(event) =>
                      setPlanDraft((current) => ({
                        ...current,
                        runMode: event.target.value as PlanResource["runMode"]
                      }))
                    }
                  >
                    <option value="headless">无头模式</option>
                    <option value="headed">有头模式</option>
                  </select>
                </label>
                <label>
                  关联站点
                  <select
                    value={planDraft.siteId}
                    onChange={(event) =>
                      setPlanDraft((current) => ({ ...current, siteId: event.target.value }))
                    }
                  >
                    {platformState?.sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  关联画像
                  <select
                    value={planDraft.profileId}
                    onChange={(event) =>
                      setPlanDraft((current) => ({ ...current, profileId: event.target.value }))
                    }
                  >
                    {platformState?.profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  关联邮箱配置
                  <select
                    value={planDraft.mailConfigId}
                    onChange={(event) =>
                      setPlanDraft((current) => ({ ...current, mailConfigId: event.target.value }))
                    }
                  >
                    {platformState?.mailConfigs.map((mailConfig) => (
                      <option key={mailConfig.id} value={mailConfig.id}>
                        {mailConfig.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={planDraft.continueAfterProtectedChallenge}
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      continueAfterProtectedChallenge: event.target.checked
                    }))
                  }
                />
                允许人工完成挑战后继续执行
              </label>
              <label>
                描述
                <textarea
                  rows={5}
                  value={planDraft.description}
                  onChange={(event) =>
                    setPlanDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="toolbar-row">
                <button type="button" className="accent-button" onClick={handlePlanSave}>
                  保存方案
                </button>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === "profiles" ? (
          <>
            <SectionCard
              title="目标画像"
              subtitle="画像配置描述选择器、挑战识别、结果判定和邮箱规则。"
              actions={
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setProfileDraft(profileToEditor())}
                >
                  新建画像
                </button>
              }
            >
              <div className="resource-list">
                {platformState?.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={selectedProfileId === profile.id ? "resource-chip is-active" : "resource-chip"}
                    onClick={() => setSelectedProfileId(profile.id || "")}
                  >
                    <strong>{profile.name}</strong>
                    <span>{profile.expectedOutcomes.join(", ")}</span>
                  </button>
                )) || <p className="empty-copy">暂无画像配置。</p>}
              </div>
            </SectionCard>

            <SectionCard
              title="画像编辑器"
              subtitle="v1 仍保留 JSON 编辑能力，方便兼容现有选择器密度。"
            >
              <div className="form-grid">
                <label>
                  画像名称
                  <input
                    value={profileDraft.name}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  邮箱目录
                  <input
                    value={profileDraft.mailbox}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, mailbox: event.target.value }))
                    }
                  />
                </label>
                <label>
                  发件人过滤
                  <input
                    value={profileDraft.senderFilter}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        senderFilter: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  主题过滤
                  <input
                    value={profileDraft.subjectFilter}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        subjectFilter: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={profileDraft.enabled}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                启用邮箱验证码链路
              </label>
              <label>
                期望结果（逗号分隔）
                <input
                  value={profileDraft.expectedOutcomesText}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      expectedOutcomesText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                授权权限（逗号分隔）
                <input
                  value={profileDraft.grantedPermissionsText}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      grantedPermissionsText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                验证码正则
                <input
                  value={profileDraft.codePattern}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, codePattern: event.target.value }))
                  }
                />
              </label>
              <label>
                选择器 JSON
                <textarea
                  rows={14}
                  className="code-area"
                  value={profileDraft.selectorsText}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      selectorsText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                描述
                <textarea
                  rows={4}
                  value={profileDraft.description}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="toolbar-row">
                <button type="button" className="accent-button" onClick={handleProfileSave}>
                  保存画像
                </button>
              </div>
            </SectionCard>
          </>
        ) : null}

        {activeTab === "mail" ? (
          <>
            <SectionCard
              title="邮箱配置"
              subtitle="邮箱配置同时承担验证链路与平台健康度信号。"
              actions={
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setMailDraft(emptyMailDraft())}
                >
                  新建邮箱配置
                </button>
              }
            >
              <div className="resource-list">
                {platformState?.mailConfigs.map((mailConfig) => (
                  <button
                    key={mailConfig.id}
                    type="button"
                    className={selectedMailConfigId === mailConfig.id ? "resource-chip is-active" : "resource-chip"}
                    onClick={() => setSelectedMailConfigId(mailConfig.id || "")}
                  >
                    <strong>{mailConfig.name}</strong>
                    <span>
                      {readiness?.mailConfigs[mailConfig.id || ""]?.label || mailConfig.mode}
                    </span>
                  </button>
                )) || <p className="empty-copy">暂无邮箱配置。</p>}
              </div>
            </SectionCard>

            <SectionCard
              title="邮箱编辑器"
              subtitle={mailDraft.id ? readiness?.mailConfigs[mailDraft.id]?.detail || "保存后可测试连接。" : "保存后可测试连接。"}
            >
              <div className="form-grid">
                <label>
                  配置名称
                  <input
                    value={mailDraft.name}
                    onChange={(event) =>
                      setMailDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  接入模式
                  <select
                    value={mailDraft.mode}
                    onChange={(event) =>
                      setMailDraft((current) => ({
                        ...current,
                        mode: event.target.value as MailConfigResource["mode"]
                      }))
                    }
                  >
                    <option value="temp-mail">临时邮箱 API</option>
                    <option value="imap">IMAP</option>
                  </select>
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={mailDraft.enabled}
                  onChange={(event) =>
                    setMailDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                启用邮箱配置
              </label>
              {mailDraft.mode === "temp-mail" ? (
                <div className="form-grid">
                  <label>
                    服务地址
                    <input
                      value={mailDraft.baseUrl}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      value={mailDraft.apiKey}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, apiKey: event.target.value }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="form-grid">
                  <label>
                    IMAP 主机
                    <input
                      value={mailDraft.imapHost}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, imapHost: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    IMAP 端口
                    <input
                      type="number"
                      value={mailDraft.imapPort}
                      onChange={(event) =>
                        setMailDraft((current) => ({
                          ...current,
                          imapPort: Number(event.target.value || 993)
                        }))
                      }
                    />
                  </label>
                  <label>
                    IMAP 用户
                    <input
                      value={mailDraft.imapUser}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, imapUser: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    IMAP 密码
                    <input
                      type="password"
                      value={mailDraft.imapPass}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, imapPass: event.target.value }))
                      }
                    />
                  </label>
                </div>
              )}
              <label>
                描述
                <textarea
                  rows={4}
                  value={mailDraft.description}
                  onChange={(event) =>
                    setMailDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="toolbar-row">
                <button type="button" className="accent-button" onClick={handleMailSave}>
                  保存邮箱配置
                </button>
                <button type="button" className="ghost-button" onClick={handleMailTest}>
                  测试连接
                </button>
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}
