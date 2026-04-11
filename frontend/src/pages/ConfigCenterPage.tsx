import { startTransition, useEffect, useState } from "react";

import { ActionIconButton } from "../components/ActionIconButton";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DrawerPanel } from "../components/DrawerPanel";
import { SectionCard } from "../components/SectionCard";
import { StatusPill } from "../components/StatusPill";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/formatters";
import type {
  BrowserEnvironmentConfig,
  MailConfigResource,
  PlanResource,
  PlatformState,
  ProfileResource,
  ReadinessMap,
  SiteResource
} from "../lib/types";

type ConfigTab = "sites" | "plans" | "browser-env" | "profiles" | "mail";
type PanelMode = "view" | "edit";
type PendingDeleteResource =
  | { kind: "site"; id: string; name: string }
  | { kind: "plan"; id: string; name: string }
  | { kind: "profile"; id: string; name: string }
  | { kind: "mail"; id: string; name: string }
  | { kind: "browser-env"; id: string; name: string };

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

interface BrowserEnvEditorState {
  id?: string;
  name: string;
  description: string;
  sourceType: BrowserEnvironmentConfig["sourceType"];
  sourceLabel: string;
  approvalStatus: BrowserEnvironmentConfig["approvalStatus"];
  approvedBy: string;
  approvedAt: string;
  browserName: string;
  browserVersion: string;
  platform: string;
  userAgent: string;
  locale: string;
  languagesText: string;
  timezone: string;
  userAgentMetadataText: string;
  viewportText: string;
  screenText: string;
  geolocationText: string;
  importJson: string;
}

interface SelectionOverrides {
  siteId?: string;
  planId?: string;
  profileId?: string;
  mailConfigId?: string;
  browserEnvironmentConfigId?: string;
}

const DEFAULT_BROWSER_ENVIRONMENT_TEMPLATE: BrowserEnvironmentConfig = {
  name: "默认浏览器环境",
  description: "已从现有 Playwright 默认浏览器配置自动引导生成。",
  sourceType: "approved-template",
  sourceLabel: "playwright-defaults",
  approvalStatus: "approved",
  approvedBy: "system-bootstrap",
  approvedAt: "",
  browserName: "Chromium",
  browserVersion: "131.0.0.0",
  platform: "Windows",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  userAgentMetadata: {
    brands: [
      { brand: "Chromium", version: "131" },
      { brand: "Not_A Brand", version: "24" },
      { brand: "Google Chrome", version: "131" }
    ],
    mobile: false,
    platform: "Windows",
    architecture: "x86",
    bitness: "64",
    model: "",
    platformVersion: "10.0.0",
    fullVersionList: [
      { brand: "Chromium", version: "131.0.0.0" },
      { brand: "Not_A Brand", version: "24.0.0.0" },
      { brand: "Google Chrome", version: "131.0.0.0" }
    ]
  },
  locale: "en-US",
  languages: ["en-US", "en"],
  timezone: "America/Los_Angeles",
  viewport: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  },
  screen: {
    width: 1440,
    height: 900,
    availWidth: 1440,
    availHeight: 900,
    colorDepth: 24,
    pixelDepth: 24
  },
  geolocation: {
    latitude: 34.0522,
    longitude: -118.2437,
    accuracy: 100
  }
};

function emptySiteDraft(): SiteResource {
  return { name: "", description: "", startUrl: "" };
}

function emptyPlanDraft(fallbacks: {
  siteId?: string;
  profileId?: string;
  mailConfigId?: string;
  browserEnvironmentConfigId?: string;
}): PlanResource {
  return {
    name: "",
    description: "",
    siteId: fallbacks.siteId || "",
    profileId: fallbacks.profileId || "",
    mailConfigId: fallbacks.mailConfigId || "",
    browserEnvironmentConfigId: fallbacks.browserEnvironmentConfigId || "",
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

function emptyBrowserEnvDraft(
  template: BrowserEnvironmentConfig = DEFAULT_BROWSER_ENVIRONMENT_TEMPLATE
): BrowserEnvEditorState {
  return {
    name: "",
    description: "",
    sourceType: "manual",
    sourceLabel: "",
    approvalStatus: "approved",
    approvedBy: "system",
    approvedAt: "",
    browserName: template.browserName,
    browserVersion: template.browserVersion,
    platform: template.platform,
    userAgent: template.userAgent,
    locale: template.locale,
    languagesText: (template.languages || []).join(", "),
    timezone: template.timezone,
    userAgentMetadataText: JSON.stringify(
      template.userAgentMetadata || {},
      null,
      2
    ),
    viewportText: JSON.stringify(
      template.viewport || {},
      null,
      2
    ),
    screenText: JSON.stringify(
      template.screen || {},
      null,
      2
    ),
    geolocationText: JSON.stringify(
      template.geolocation || null,
      null,
      2
    ),
    importJson: ""
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

function browserEnvToEditor(config?: BrowserEnvironmentConfig): BrowserEnvEditorState {
  if (!config) {
    return emptyBrowserEnvDraft();
  }

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    sourceType: config.sourceType,
    sourceLabel: config.sourceLabel,
    approvalStatus: config.approvalStatus,
    approvedBy: config.approvedBy,
    approvedAt: config.approvedAt,
    browserName: config.browserName,
    browserVersion: config.browserVersion,
    platform: config.platform,
    userAgent: config.userAgent,
    locale: config.locale,
    languagesText: (config.languages || []).join(", "),
    timezone: config.timezone,
    userAgentMetadataText: JSON.stringify(config.userAgentMetadata || {}, null, 2),
    viewportText: JSON.stringify(config.viewport || {}, null, 2),
    screenText: JSON.stringify(config.screen || {}, null, 2),
    geolocationText: JSON.stringify(config.geolocation || null, null, 2),
    importJson: ""
  };
}

function editorToBrowserEnvironmentConfig(
  editor: BrowserEnvEditorState
): BrowserEnvironmentConfig {
  const autoApprovedAt = editor.approvedAt || new Date().toISOString();

  return {
    id: editor.id,
    name: editor.name,
    description: editor.description,
    sourceType: editor.sourceType,
    sourceLabel: editor.sourceLabel,
    approvalStatus: "approved",
    approvedBy: editor.approvedBy || "system",
    approvedAt: autoApprovedAt,
    browserName: editor.browserName,
    browserVersion: editor.browserVersion,
    platform: editor.platform,
    userAgent: editor.userAgent,
    userAgentMetadata: JSON.parse(editor.userAgentMetadataText || "{}") as BrowserEnvironmentConfig["userAgentMetadata"],
    locale: editor.locale,
    languages: editor.languagesText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    timezone: editor.timezone,
    viewport: JSON.parse(editor.viewportText || "{}") as BrowserEnvironmentConfig["viewport"],
    screen: JSON.parse(editor.screenText || "{}") as BrowserEnvironmentConfig["screen"],
    geolocation: JSON.parse(editor.geolocationText || "null") as BrowserEnvironmentConfig["geolocation"]
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

function includesSearch(query: string, values: Array<string | undefined>) {
  if (!query) {
    return true;
  }

  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
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

function panelModeLabel(mode: PanelMode) {
  return mode === "edit" ? "修改模式" : "查看模式";
}

function panelModeTone(mode: PanelMode) {
  return mode === "edit" ? "accent" : "neutral";
}

function runModeLabel(mode: PlanResource["runMode"]) {
  return mode === "headed" ? "有头模式" : "无头模式";
}

function mailModeLabel(mode: MailConfigResource["mode"]) {
  return mode === "imap" ? "IMAP" : "临时邮箱 API";
}

function browserEnvironmentApprovalLabel(status: string) {
  switch (status) {
    case "approved":
      return "已批准";
    case "rejected":
      return "已拒绝";
    default:
      return "待批准";
  }
}

function browserEnvironmentApprovalTone(status: string) {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "warning";
  }
}

export function ConfigCenterPage() {
  const [platformState, setPlatformState] = useState<PlatformState | null>(null);
  const [readiness, setReadiness] = useState<ReadinessMap | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>("sites");
  const [panelMode, setPanelMode] = useState<PanelMode>("view");
  const [listSearch, setListSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedMailConfigId, setSelectedMailConfigId] = useState("");
  const [siteDraft, setSiteDraft] = useState<SiteResource>(emptySiteDraft());
  const [planDraft, setPlanDraft] = useState<PlanResource>(emptyPlanDraft({}));
  const [profileDraft, setProfileDraft] = useState<ProfileEditorState>(profileToEditor());
  const [mailDraft, setMailDraft] = useState<MailConfigResource>(emptyMailDraft());
  const [browserEnvDraft, setBrowserEnvDraft] = useState<BrowserEnvEditorState>(
    emptyBrowserEnvDraft()
  );
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedBrowserEnvId, setSelectedBrowserEnvId] = useState("");
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [pendingDeleteResource, setPendingDeleteResource] =
    useState<PendingDeleteResource | null>(null);
  const [isDeletingResource, setIsDeletingResource] = useState(false);

  const query = listSearch.trim().toLowerCase();
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
  const selectedProfileLinkedPlans = (platformState?.plans || []).filter(
    (plan) => plan.profileId === profileDraft.id
  );
  const selectedMailLinkedPlans = (platformState?.plans || []).filter(
    (plan) => plan.mailConfigId === mailDraft.id
  );
  const selectedBrowserEnvLinkedPlans = (platformState?.plans || []).filter(
    (plan) => plan.browserEnvironmentConfigId === browserEnvDraft.id
  );

  function clearFeedback() {
    setMessage("");
    setSuccess("");
  }

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
    setSelectedBrowserEnvId((current) =>
      resolveSelection(
        nextState.state.browserEnvironmentConfigs || [],
        overrides.browserEnvironmentConfigId ?? current,
        nextState.state.selectedBrowserEnvironmentConfigId
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
    setSiteDraft(selectedSite || emptySiteDraft());
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
        mailConfigId: platformState?.selectedMailConfigId || platformState?.mailConfigs[0]?.id,
        browserEnvironmentConfigId:
          platformState?.selectedBrowserEnvironmentConfigId ||
          platformState?.browserEnvironmentConfigs[0]?.id
      })
    );
  }, [platformState, selectedPlanId]);

  useEffect(() => {
    const selectedProfile = platformState
      ? activeItem(platformState.profiles, selectedProfileId)
      : null;
    setProfileDraft(profileToEditor(selectedProfile || undefined));
  }, [platformState, selectedProfileId]);

  useEffect(() => {
    const selectedMailConfig = platformState
      ? activeItem(platformState.mailConfigs, selectedMailConfigId)
      : null;
    setMailDraft(selectedMailConfig || emptyMailDraft());
  }, [platformState, selectedMailConfigId]);

  useEffect(() => {
    if (panelMode === "edit" && !selectedBrowserEnvId) {
      return;
    }

    const selectedBrowserEnvironmentConfig = platformState
      ? activeItem(platformState.browserEnvironmentConfigs, selectedBrowserEnvId)
      : null;
    setBrowserEnvDraft(browserEnvToEditor(selectedBrowserEnvironmentConfig || undefined));
  }, [panelMode, platformState, selectedBrowserEnvId]);

  async function reloadState(overrides: SelectionOverrides = {}) {
    const nextState = await api.getState();
    applyLoadedState(nextState, overrides);
    return nextState.state;
  }

  function beginCreateSite() {
    setSelectedSiteId("");
    setSiteDraft(emptySiteDraft());
    setPanelMode("edit");
    clearFeedback();
  }

  function beginCreatePlan() {
    setSelectedPlanId("");
    setPlanDraft(
      emptyPlanDraft({
        siteId: platformState?.selectedSiteId,
        profileId: platformState?.selectedProfileId,
        mailConfigId: platformState?.selectedMailConfigId,
        browserEnvironmentConfigId: platformState?.selectedBrowserEnvironmentConfigId
      })
    );
    setPanelMode("edit");
    clearFeedback();
  }

  function beginCreateProfile() {
    setSelectedProfileId("");
    setProfileDraft(profileToEditor());
    setPanelMode("edit");
    clearFeedback();
  }

  function beginCreateMailConfig() {
    setSelectedMailConfigId("");
    setMailDraft(emptyMailDraft());
    setPanelMode("edit");
    clearFeedback();
  }

  function beginCreateBrowserEnvironment() {
    const templateConfig =
      (platformState
        ? activeItem(platformState.browserEnvironmentConfigs, selectedBrowserEnvId)
        : null) ||
      platformState?.browserEnvironmentConfigs[0];
    setSelectedBrowserEnvId("");
    setBrowserEnvDraft(emptyBrowserEnvDraft(templateConfig));
    setPanelMode("edit");
    clearFeedback();
  }

  function activateCurrentTabRecord(recordId: string, mode: PanelMode) {
    clearFeedback();
    setPanelMode(mode);

    if (activeTab === "sites") {
      setSelectedSiteId(recordId);
      return;
    }

    if (activeTab === "plans") {
      setSelectedPlanId(recordId);
      return;
    }

    if (activeTab === "profiles") {
      setSelectedProfileId(recordId);
      return;
    }

    if (activeTab === "browser-env") {
      setSelectedBrowserEnvId(recordId);
      return;
    }

    setSelectedMailConfigId(recordId);
  }

  async function handleSiteSave() {
    try {
      const savedSite = await api.saveSite(siteDraft);
      const nextState = await reloadState({ siteId: savedSite.id || "" });
      setSelectedSiteId(savedSite.id || nextState.selectedSiteId);
      setPanelMode("view");
      setSuccess("站点资源已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存站点失败。");
    }
  }

  async function handlePlanSave() {
    try {
      const savedPlan = await api.savePlan(planDraft);
      const nextState = await reloadState({ planId: savedPlan.id || "" });
      setSelectedPlanId(savedPlan.id || nextState.selectedPlanId);
      setPanelMode("view");
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
      setPanelMode("view");
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
      setPanelMode("view");
      setSuccess("邮箱配置已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(error instanceof Error ? error.message : "保存邮箱配置失败。");
    }
  }

  async function handleBrowserEnvironmentSave() {
    try {
      const savedBrowserEnvironmentConfig =
        await api.saveBrowserEnvironmentConfig(
          editorToBrowserEnvironmentConfig(browserEnvDraft)
        );
      const nextState = await reloadState({
        browserEnvironmentConfigId: savedBrowserEnvironmentConfig.id || ""
      });
      setSelectedBrowserEnvId(
        savedBrowserEnvironmentConfig.id ||
          nextState.selectedBrowserEnvironmentConfigId
      );
      setPanelMode("view");
      setSuccess("浏览器环境配置已保存。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(
        error instanceof Error
          ? error.message
          : "保存浏览器环境配置失败，请检查 JSON 或审批信息。"
      );
    }
  }

  async function handleBrowserEnvironmentImport() {
    try {
      if (!browserEnvDraft.importJson.trim()) {
        throw new Error("请先粘贴历史 fingerprint JSON。");
      }

      const payload = JSON.parse(browserEnvDraft.importJson);
      const importedBrowserEnvironmentConfig =
        await api.importLegacyBrowserEnvironmentConfig(
          browserEnvDraft.sourceLabel || "legacy-import.json",
          payload
        );
      const nextState = await reloadState({
        browserEnvironmentConfigId: importedBrowserEnvironmentConfig.id || ""
      });
      setSelectedBrowserEnvId(
        importedBrowserEnvironmentConfig.id ||
          nextState.selectedBrowserEnvironmentConfigId
      );
      setPanelMode("view");
      setSuccess("历史 fingerprint 资产已迁移为浏览器环境配置。");
      setMessage("");
    } catch (error) {
      setSuccess("");
      setMessage(
        error instanceof Error ? error.message : "导入历史 fingerprint 资产失败。"
      );
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

  function handleSiteDelete(site: SiteResource) {
    if (!site.id) {
      return;
    }

    setPendingDeleteResource({
      kind: "site",
      id: site.id,
      name: site.name || "未命名站点"
    });
  }

  function handlePlanDelete(plan: PlanResource) {
    if (!plan.id) {
      return;
    }

    setPendingDeleteResource({
      kind: "plan",
      id: plan.id,
      name: plan.name || "未命名方案"
    });
  }

  function handleProfileDelete(profile: Pick<ProfileResource, "id" | "name">) {
    if (!profile.id) {
      return;
    }

    setPendingDeleteResource({
      kind: "profile",
      id: profile.id,
      name: profile.name || "未命名画像"
    });
  }

  function handleMailDelete(mailConfig: MailConfigResource) {
    if (!mailConfig.id) {
      return;
    }

    setPendingDeleteResource({
      kind: "mail",
      id: mailConfig.id,
      name: mailConfig.name || "未命名邮箱配置"
    });
  }

  function handleBrowserEnvironmentDelete(
    browserEnvironmentConfig: BrowserEnvironmentConfig
  ) {
    if (!browserEnvironmentConfig.id) {
      return;
    }

    setPendingDeleteResource({
      kind: "browser-env",
      id: browserEnvironmentConfig.id,
      name: browserEnvironmentConfig.name || "未命名配置"
    });
  }

  async function handleConfirmDeleteResource() {
    if (!pendingDeleteResource) {
      return;
    }

    try {
      setIsDeletingResource(true);

      switch (pendingDeleteResource.kind) {
        case "site": {
          const deletedSite = await api.deleteSite(pendingDeleteResource.id);
          await reloadState({ siteId: "" });
          setSuccess(`站点资源“${deletedSite.name || "未命名站点"}”已删除。`);
          break;
        }
        case "plan": {
          const deletedPlan = await api.deletePlan(pendingDeleteResource.id);
          await reloadState({ planId: "" });
          setSuccess(`测试方案“${deletedPlan.name || "未命名方案"}”已删除。`);
          break;
        }
        case "profile": {
          const deletedProfile = await api.deleteProfile(pendingDeleteResource.id);
          await reloadState({ profileId: "" });
          setSuccess(`画像配置“${deletedProfile.name || "未命名画像"}”已删除。`);
          break;
        }
        case "mail": {
          const deletedMail = await api.deleteMailConfig(pendingDeleteResource.id);
          await reloadState({ mailConfigId: "" });
          setSuccess(`邮箱配置“${deletedMail.name || "未命名邮箱配置"}”已删除。`);
          break;
        }
        case "browser-env": {
          const deletedBrowserEnvironmentConfig =
            await api.deleteBrowserEnvironmentConfig(pendingDeleteResource.id);
          await reloadState({ browserEnvironmentConfigId: "" });
          setSuccess(
            `浏览器环境配置“${deletedBrowserEnvironmentConfig.name || "未命名配置"}”已删除。`
          );
          break;
        }
        default:
          break;
      }

      setPanelMode("view");
      setMessage("");
      setPendingDeleteResource(null);
    } catch (error) {
      setSuccess("");
      setMessage(
        error instanceof Error ? error.message : "删除资源失败。"
      );
    } finally {
      setIsDeletingResource(false);
    }
  }

  function handleQuickCreate(tabId: ConfigTab) {
    startTransition(() => {
      setActiveTab(tabId);
      clearFeedback();
      setIsQuickCreateOpen(false);

      switch (tabId) {
        case "sites":
          beginCreateSite();
          break;
        case "plans":
          beginCreatePlan();
          break;
        case "browser-env":
          beginCreateBrowserEnvironment();
          break;
        case "profiles":
          beginCreateProfile();
          break;
        case "mail":
          beginCreateMailConfig();
          break;
        default:
          break;
      }
    });
  }

  const filteredSites = (platformState?.sites || []).filter((site) =>
    includesSearch(query, [site.name, site.description, site.startUrl])
  );
  const filteredPlans = (platformState?.plans || []).filter((plan) =>
    includesSearch(query, [plan.name, plan.description, runModeLabel(plan.runMode)])
  );
  const filteredProfiles = (platformState?.profiles || []).filter((profile) =>
    includesSearch(query, [profile.name, profile.description, profile.expectedOutcomes.join(" ")])
  );
  const filteredMailConfigs = (platformState?.mailConfigs || []).filter((mailConfig) =>
    includesSearch(query, [
      mailConfig.name,
      mailConfig.description,
      mailModeLabel(mailConfig.mode),
      readiness?.mailConfigs[mailConfig.id || ""]?.label
    ])
  );
  const filteredBrowserEnvironmentConfigs =
    (platformState?.browserEnvironmentConfigs || []).filter(
      (browserEnvironmentConfig) =>
        includesSearch(query, [
          browserEnvironmentConfig.name,
          browserEnvironmentConfig.description,
          browserEnvironmentConfig.browserVersion,
          browserEnvironmentConfig.sourceLabel,
          browserEnvironmentApprovalLabel(
            browserEnvironmentConfig.approvalStatus
          )
        ])
    );

  const tabButtons: Array<{ id: ConfigTab; label: string; helper: string }> = [
    { id: "sites", label: "站点", helper: `${platformState?.sites.length ?? 0} 条` },
    { id: "plans", label: "方案", helper: `${platformState?.plans.length ?? 0} 条` },
    {
      id: "browser-env",
      label: "浏览器环境",
      helper: `${platformState?.browserEnvironmentConfigs.length ?? 0} 条`
    },
    { id: "profiles", label: "画像", helper: `${platformState?.profiles.length ?? 0} 条` },
    { id: "mail", label: "邮箱", helper: `${platformState?.mailConfigs.length ?? 0} 条` }
  ];
  const activeTabMeta = tabButtons.find((tab) => tab.id === activeTab) || tabButtons[0];
  const quickCreateDescriptions: Record<ConfigTab, string> = {
    sites: "维护被授权测试站点的入口、说明和目标地址。",
    plans: "为不同站点组合运行模式、画像、邮箱和浏览器环境。",
    "browser-env": "登记批准来源、版本与审计信息一致的浏览器环境。",
    profiles: "维护选择器、期望结果和验证码识别规则。",
    mail: "管理临时邮箱 API 或 IMAP 链路的接入配置。"
  };
  const deleteResourceDescription = pendingDeleteResource
    ? `删除${pendingDeleteResource.name}后，当前资源会从控制台台账中移除。请先确认没有仍在使用该资源的方案或流程。`
    : "";

  const isEditMode = panelMode === "edit";
  const siteCanDelete =
    Boolean(siteDraft.id) &&
    selectedSitePlans.length === 0 &&
    (platformState?.sites.length || 0) > 1;
  const planCanDelete = Boolean(planDraft.id) && (platformState?.plans.length || 0) > 1;
  const profileCanDelete =
    Boolean(profileDraft.id) &&
    !selectedProfileLinkedPlans.length &&
    (platformState?.profiles.length || 0) > 1;
  const mailCanDelete =
    Boolean(mailDraft.id) &&
    !selectedMailLinkedPlans.length &&
    (platformState?.mailConfigs.length || 0) > 1;
  const browserEnvironmentCanDelete =
    Boolean(browserEnvDraft.id) &&
    !selectedBrowserEnvLinkedPlans.length &&
    (platformState?.browserEnvironmentConfigs.length || 0) > 1;

  return (
    <div className="workspace-stack">
      <WorkspaceHeader
        eyebrow="配置中心"
        title="所有资源都回到一张台账里"
        description="站点、方案、画像和邮箱统一按列表管理。左侧看索引，右侧看详情和编辑，不再让配置像散落的工具页。"
        actions={
          <>
            <button
              type="button"
              className="accent-button"
              onClick={() => setIsQuickCreateOpen(true)}
            >
              快捷新建
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() =>
                startTransition(() => {
                  clearFeedback();
                })
              }
            >
              清空提示
            </button>
          </>
        }
      />

      {message ? <div className="banner banner-danger">{message}</div> : null}
      {success ? <div className="banner banner-success">{success}</div> : null}

      <SectionCard
        title="资源索引"
        subtitle="先选择资源类型，再按统一列表查看、修改或删除。"
        actions={<StatusPill tone="accent">{activeTabMeta.label}</StatusPill>}
      >
        <div className="panel-toolbar panel-toolbar--split">
          <div className="tab-row">
            {tabButtons.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "tab-button is-active" : "tab-button"}
                onClick={() =>
                  startTransition(() => {
                    setActiveTab(tab.id);
                    setPanelMode("view");
                    clearFeedback();
                  })
                }
              >
                {tab.label}
                <small>{tab.helper}</small>
              </button>
            ))}
          </div>

          <div className="panel-toolbar">
            <label className="inline-search">
              <input
                value={listSearch}
                placeholder="搜索当前资源"
                onChange={(event) =>
                  startTransition(() => {
                    setListSearch(event.target.value);
                  })
                }
              />
            </label>
            {activeTab === "sites" ? (
              <button type="button" className="accent-button" onClick={beginCreateSite}>
                新建站点
              </button>
            ) : null}
            {activeTab === "plans" ? (
              <button type="button" className="accent-button" onClick={beginCreatePlan}>
                新建方案
              </button>
            ) : null}
            {activeTab === "browser-env" ? (
              <button
                type="button"
                className="accent-button"
                onClick={beginCreateBrowserEnvironment}
              >
                新建浏览器环境
              </button>
            ) : null}
            {activeTab === "profiles" ? (
              <button type="button" className="accent-button" onClick={beginCreateProfile}>
                新建画像
              </button>
            ) : null}
            {activeTab === "mail" ? (
              <button type="button" className="accent-button" onClick={beginCreateMailConfig}>
                新建邮箱
              </button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <div className="detail-layout detail-layout--wide">
        <SectionCard
          title="资源台账"
          subtitle="当前 tab 下的资源统一用标准列表展示，操作列固定在最右侧。"
        >
          {activeTab === "sites" ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>站点</th>
                    <th>地址</th>
                    <th>方案数</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.length ? (
                    filteredSites.map((site) => {
                      const linkedPlans = plansBySiteId[site.id || ""] || [];
                      const canDelete = linkedPlans.length === 0 && (platformState?.sites.length || 0) > 1;
                      return (
                        <tr
                          key={site.id}
                          className={selectedSiteId === site.id ? "is-selected" : undefined}
                          onClick={() => activateCurrentTabRecord(site.id || "", "view")}
                        >
                          <td>
                            <div className="table-primary">
                              <strong>{site.name}</strong>
                              <span>{site.description || "未填写站点说明"}</span>
                            </div>
                          </td>
                          <td>{site.startUrl || "未配置地址"}</td>
                          <td>{linkedPlans.length}</td>
                          <td>
                            <StatusPill tone={site.startUrl ? "success" : "warning"}>
                              {site.startUrl ? "可运行" : "待补全"}
                            </StatusPill>
                          </td>
                          <td>{formatDateTime(site.updatedAt)}</td>
                          <td>
                            <div className="table-actions">
                              <ActionIconButton
                                icon="view"
                                label="查看"
                                tone="accent"
                                onClick={() => activateCurrentTabRecord(site.id || "", "view")}
                              />
                              <ActionIconButton
                                icon="edit"
                                label="修改"
                                onClick={() => activateCurrentTabRecord(site.id || "", "edit")}
                              />
                              <ActionIconButton
                                icon="delete"
                                label="删除"
                                tone="danger"
                                disabled={!canDelete}
                                onClick={() => handleSiteDelete(site)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        当前条件下没有站点资源。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "plans" ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>方案</th>
                    <th>站点</th>
                    <th>画像 / 邮箱 / 浏览器环境</th>
                    <th>运行模式</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlans.length ? (
                    filteredPlans.map((plan) => {
                      const site = platformState?.sites.find((item) => item.id === plan.siteId);
                      const profile = platformState?.profiles.find((item) => item.id === plan.profileId);
                      const mail = platformState?.mailConfigs.find((item) => item.id === plan.mailConfigId);
                      const browserEnvironmentConfig =
                        platformState?.browserEnvironmentConfigs.find(
                          (item) => item.id === plan.browserEnvironmentConfigId
                        );
                      return (
                        <tr
                          key={plan.id}
                          className={selectedPlanId === plan.id ? "is-selected" : undefined}
                          onClick={() => activateCurrentTabRecord(plan.id || "", "view")}
                        >
                          <td>
                            <div className="table-primary">
                              <strong>{plan.name}</strong>
                              <span>{plan.description || "未填写方案说明"}</span>
                            </div>
                          </td>
                          <td>{site?.name || "未找到站点"}</td>
                          <td>{`${profile?.name || "未找到画像"} / ${mail?.name || "未找到邮箱"} / ${
                            browserEnvironmentConfig?.name || "未绑定浏览器环境"
                          }`}</td>
                          <td>
                            <StatusPill tone={plan.runMode === "headed" ? "accent" : "neutral"}>
                              {runModeLabel(plan.runMode)}
                            </StatusPill>
                          </td>
                          <td>{formatDateTime(plan.updatedAt)}</td>
                          <td>
                            <div className="table-actions">
                              <ActionIconButton
                                icon="view"
                                label="查看"
                                tone="accent"
                                onClick={() => activateCurrentTabRecord(plan.id || "", "view")}
                              />
                              <ActionIconButton
                                icon="edit"
                                label="修改"
                                onClick={() => activateCurrentTabRecord(plan.id || "", "edit")}
                              />
                              <ActionIconButton
                                icon="delete"
                                label="删除"
                                tone="danger"
                                disabled={(platformState?.plans.length || 0) <= 1}
                                onClick={() => handlePlanDelete(plan)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        当前条件下没有测试方案。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "browser-env" ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>浏览器环境</th>
                    <th>浏览器版本</th>
                    <th>来源</th>
                    <th>审批状态</th>
                    <th>被引用方案</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBrowserEnvironmentConfigs.length ? (
                    filteredBrowserEnvironmentConfigs.map(
                      (browserEnvironmentConfig) => {
                        const referencedPlans = (platformState?.plans || []).filter(
                          (plan) =>
                            plan.browserEnvironmentConfigId === browserEnvironmentConfig.id
                        );
                        return (
                          <tr
                            key={browserEnvironmentConfig.id}
                            className={
                              selectedBrowserEnvId === browserEnvironmentConfig.id
                                ? "is-selected"
                                : undefined
                            }
                            onClick={() =>
                              activateCurrentTabRecord(
                                browserEnvironmentConfig.id || "",
                                "view"
                              )
                            }
                          >
                            <td>
                              <div className="table-primary">
                                <strong>{browserEnvironmentConfig.name}</strong>
                                <span>
                                  {browserEnvironmentConfig.description ||
                                    "未填写浏览器环境说明"}
                                </span>
                              </div>
                            </td>
                            <td>{browserEnvironmentConfig.browserVersion || "未设置"}</td>
                            <td>{browserEnvironmentConfig.sourceLabel || "未标注"}</td>
                            <td>
                              <StatusPill
                                tone={browserEnvironmentApprovalTone(
                                  browserEnvironmentConfig.approvalStatus
                                )}
                              >
                                {browserEnvironmentApprovalLabel(
                                  browserEnvironmentConfig.approvalStatus
                                )}
                              </StatusPill>
                            </td>
                            <td>{referencedPlans.length}</td>
                            <td>{formatDateTime(browserEnvironmentConfig.updatedAt)}</td>
                            <td>
                              <div className="table-actions">
                                <ActionIconButton
                                  icon="view"
                                  label="查看"
                                  tone="accent"
                                  onClick={() =>
                                    activateCurrentTabRecord(
                                      browserEnvironmentConfig.id || "",
                                      "view"
                                    )
                                  }
                                />
                                <ActionIconButton
                                  icon="edit"
                                  label="修改"
                                  onClick={() =>
                                    activateCurrentTabRecord(
                                      browserEnvironmentConfig.id || "",
                                      "edit"
                                    )
                                  }
                                />
                                <ActionIconButton
                                  icon="delete"
                                  label="删除"
                                  tone="danger"
                                  disabled={
                                    referencedPlans.length > 0 ||
                                    (platformState?.browserEnvironmentConfigs.length || 0) <= 1
                                  }
                                  onClick={() =>
                                    handleBrowserEnvironmentDelete(browserEnvironmentConfig)
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        当前条件下没有浏览器环境配置。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "profiles" ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>画像</th>
                    <th>期望结果</th>
                    <th>邮箱链路</th>
                    <th>被引用方案</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.length ? (
                    filteredProfiles.map((profile) => {
                      const referencedPlans = (platformState?.plans || []).filter(
                        (plan) => plan.profileId === profile.id
                      );
                      return (
                        <tr
                          key={profile.id}
                          className={selectedProfileId === profile.id ? "is-selected" : undefined}
                          onClick={() => activateCurrentTabRecord(profile.id || "", "view")}
                        >
                          <td>
                            <div className="table-primary">
                              <strong>{profile.name}</strong>
                              <span>{profile.description || "未填写画像说明"}</span>
                            </div>
                          </td>
                          <td>{profile.expectedOutcomes.join("、") || "未设置"}</td>
                          <td>
                            <StatusPill tone={profile.emailVerification.enabled ? "success" : "warning"}>
                              {profile.emailVerification.enabled ? "已启用" : "已停用"}
                            </StatusPill>
                          </td>
                          <td>{referencedPlans.length}</td>
                          <td>{formatDateTime(profile.updatedAt)}</td>
                          <td>
                            <div className="table-actions">
                              <ActionIconButton
                                icon="view"
                                label="查看"
                                tone="accent"
                                onClick={() => activateCurrentTabRecord(profile.id || "", "view")}
                              />
                              <ActionIconButton
                                icon="edit"
                                label="修改"
                                onClick={() => activateCurrentTabRecord(profile.id || "", "edit")}
                              />
                              <ActionIconButton
                                icon="delete"
                                label="删除"
                                tone="danger"
                                disabled={
                                  referencedPlans.length > 0 ||
                                  (platformState?.profiles.length || 0) <= 1
                                }
                                onClick={() => handleProfileDelete(profile)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        当前条件下没有画像配置。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === "mail" ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>邮箱配置</th>
                    <th>接入模式</th>
                    <th>就绪状态</th>
                    <th>被引用方案</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMailConfigs.length ? (
                    filteredMailConfigs.map((mailConfig) => {
                      const referencedPlans = (platformState?.plans || []).filter(
                        (plan) => plan.mailConfigId === mailConfig.id
                      );
                      const readinessInfo = readiness?.mailConfigs[mailConfig.id || ""];
                      return (
                        <tr
                          key={mailConfig.id}
                          className={selectedMailConfigId === mailConfig.id ? "is-selected" : undefined}
                          onClick={() => activateCurrentTabRecord(mailConfig.id || "", "view")}
                        >
                          <td>
                            <div className="table-primary">
                              <strong>{mailConfig.name}</strong>
                              <span>{mailConfig.description || "未填写邮箱配置说明"}</span>
                            </div>
                          </td>
                          <td>{mailModeLabel(mailConfig.mode)}</td>
                          <td>
                            <StatusPill tone={readinessInfo?.ready ? "success" : "warning"}>
                              {readinessInfo?.label || "未校验"}
                            </StatusPill>
                          </td>
                          <td>{referencedPlans.length}</td>
                          <td>{formatDateTime(mailConfig.updatedAt)}</td>
                          <td>
                            <div className="table-actions">
                              <ActionIconButton
                                icon="view"
                                label="查看"
                                tone="accent"
                                onClick={() => activateCurrentTabRecord(mailConfig.id || "", "view")}
                              />
                              <ActionIconButton
                                icon="edit"
                                label="修改"
                                onClick={() => activateCurrentTabRecord(mailConfig.id || "", "edit")}
                              />
                              <ActionIconButton
                                icon="delete"
                                label="删除"
                                tone="danger"
                                disabled={
                                  referencedPlans.length > 0 ||
                                  (platformState?.mailConfigs.length || 0) <= 1
                                }
                                onClick={() => handleMailDelete(mailConfig)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        当前条件下没有邮箱配置。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <>
          {activeTab === "sites" ? (
            <SectionCard
              title={siteDraft.id ? `站点详情 · ${siteDraft.name || "未命名站点"}` : "新建站点"}
              subtitle="右侧统一承担查看和编辑；查看模式下字段只读，切换到修改模式后再保存。"
              actions={
                <div className="panel-toolbar">
                  <StatusPill tone={panelModeTone(panelMode)}>{panelModeLabel(panelMode)}</StatusPill>
                  {!isEditMode && siteDraft.id ? (
                    <button type="button" className="ghost-button" onClick={() => setPanelMode("edit")}>
                      切换到修改
                    </button>
                  ) : null}
                  {siteCanDelete ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleSiteDelete(siteDraft)}
                    >
                      删除站点
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="detail-summary">
                <div>
                  <span>站点状态</span>
                  <strong>{siteDraft.startUrl ? "可运行" : "待补全地址"}</strong>
                  <p>{siteDraft.startUrl || "请输入 HTTPS 目标地址。"}</p>
                </div>
                <div>
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
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setSiteDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  目标地址
                  <input
                    value={siteDraft.startUrl}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setSiteDraft((current) => ({ ...current, startUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label>
                描述
                <textarea
                  rows={6}
                  value={siteDraft.description}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setSiteDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="form-footer">
                {isEditMode ? (
                  <button type="button" className="accent-button" onClick={handleSiteSave}>
                    保存站点
                  </button>
                ) : (
                  <p className="empty-copy">查看模式下不允许修改字段。点击“切换到修改”后再保存。</p>
                )}
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "plans" ? (
            <SectionCard
              title={planDraft.id ? `方案详情 · ${planDraft.name || "未命名方案"}` : "新建方案"}
              subtitle="方案是站点、画像和邮箱配置的组合结果，决定每次任务的默认运行方式。"
              actions={
                <div className="panel-toolbar">
                  <StatusPill tone={panelModeTone(panelMode)}>{panelModeLabel(panelMode)}</StatusPill>
                  {!isEditMode && planDraft.id ? (
                    <button type="button" className="ghost-button" onClick={() => setPanelMode("edit")}>
                      切换到修改
                    </button>
                  ) : null}
                  {planCanDelete ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handlePlanDelete(planDraft)}
                    >
                      删除方案
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="detail-summary">
                <div>
                  <span>默认运行模式</span>
                  <strong>{runModeLabel(planDraft.runMode)}</strong>
                  <p>运行时会用它作为默认值。</p>
                </div>
                <div>
                  <span>人工续跑</span>
                  <strong>{planDraft.continueAfterProtectedChallenge ? "已开启" : "未开启"}</strong>
                  <p>控制是否允许人工完成挑战后继续。</p>
                </div>
                <div>
                  <span>浏览器环境</span>
                  <strong>
                    {platformState?.browserEnvironmentConfigs.find(
                      (item) => item.id === planDraft.browserEnvironmentConfigId
                    )?.name || "未绑定"}
                  </strong>
                  <p>
                    {browserEnvironmentApprovalLabel(
                      platformState?.browserEnvironmentConfigs.find(
                        (item) => item.id === planDraft.browserEnvironmentConfigId
                      )?.approvalStatus || "pending"
                    )}
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  方案名称
                  <input
                    value={planDraft.name}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setPlanDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  默认运行模式
                  <select
                    value={planDraft.runMode}
                    disabled={!isEditMode}
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
                    disabled={!isEditMode}
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
                    disabled={!isEditMode}
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
                    disabled={!isEditMode}
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
                <label>
                  关联浏览器环境
                  <select
                    value={planDraft.browserEnvironmentConfigId}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setPlanDraft((current) => ({
                        ...current,
                        browserEnvironmentConfigId: event.target.value
                      }))
                    }
                  >
                    {platformState?.browserEnvironmentConfigs.map(
                      (browserEnvironmentConfig) => (
                        <option
                          key={browserEnvironmentConfig.id}
                          value={browserEnvironmentConfig.id}
                        >
                          {browserEnvironmentConfig.name}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
              <article className="insight-panel tone-neutral">
                <span>当前绑定浏览器环境</span>
                <strong>
                  {platformState?.browserEnvironmentConfigs.find(
                    (item) => item.id === planDraft.browserEnvironmentConfigId
                  )?.name || "未绑定浏览器环境"}
                </strong>
                <p>
                  审批状态：
                  {browserEnvironmentApprovalLabel(
                    platformState?.browserEnvironmentConfigs.find(
                      (item) => item.id === planDraft.browserEnvironmentConfigId
                    )?.approvalStatus || "pending"
                  )}
                </p>
              </article>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={planDraft.continueAfterProtectedChallenge}
                  disabled={!isEditMode}
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
                  rows={6}
                  value={planDraft.description}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setPlanDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="form-footer">
                {isEditMode ? (
                  <button type="button" className="accent-button" onClick={handlePlanSave}>
                    保存方案
                  </button>
                ) : (
                  <p className="empty-copy">查看模式下不允许修改字段。点击“切换到修改”后再保存。</p>
                )}
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "browser-env" ? (
            <SectionCard
              title={
                browserEnvDraft.id
                  ? `浏览器环境详情 · ${browserEnvDraft.name || "未命名配置"}`
                  : "新建浏览器环境"
              }
              subtitle="浏览器环境配置只允许保存可审计、可解释的白名单字段，并要求显式审批后才能执行。"
              actions={
                <div className="panel-toolbar">
                  <StatusPill tone={panelModeTone(panelMode)}>
                    {panelModeLabel(panelMode)}
                  </StatusPill>
                  {!isEditMode && browserEnvDraft.id ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setPanelMode("edit")}
                    >
                      切换到修改
                    </button>
                  ) : null}
                  {browserEnvironmentCanDelete ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        handleBrowserEnvironmentDelete(
                          editorToBrowserEnvironmentConfig(browserEnvDraft)
                        )
                      }
                    >
                      删除浏览器环境
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="detail-summary">
                <div>
                  <span>浏览器版本</span>
                  <strong>{browserEnvDraft.browserVersion || "未设置"}</strong>
                  <p>{browserEnvDraft.browserName || "未设置浏览器名称"}</p>
                </div>
                <div>
                  <span>被引用方案</span>
                  <strong>{selectedBrowserEnvLinkedPlans.length}</strong>
                  <p>{summarizePlanNames(selectedBrowserEnvLinkedPlans)}</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  配置名称
                  <input
                    value={browserEnvDraft.name}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  来源类型
                  <select
                    value={browserEnvDraft.sourceType}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        sourceType: event.target.value as BrowserEnvironmentConfig["sourceType"]
                      }))
                    }
                  >
                    <option value="manual">手动录入</option>
                    <option value="local-export">本地导出</option>
                    <option value="approved-template">批准模板</option>
                    <option value="legacy-import">历史迁移</option>
                  </select>
                </label>
                <label>
                  来源标记
                  <input
                    value={browserEnvDraft.sourceLabel}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        sourceLabel: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  浏览器名称
                  <input
                    value={browserEnvDraft.browserName}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        browserName: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  浏览器版本
                  <input
                    value={browserEnvDraft.browserVersion}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        browserVersion: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  平台
                  <input
                    value={browserEnvDraft.platform}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        platform: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Locale
                  <input
                    value={browserEnvDraft.locale}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        locale: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  时区
                  <input
                    value={browserEnvDraft.timezone}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        timezone: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  Languages（逗号分隔）
                  <input
                    value={browserEnvDraft.languagesText}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setBrowserEnvDraft((current) => ({
                        ...current,
                        languagesText: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                User Agent
                <textarea
                  rows={4}
                  className="code-area"
                  value={browserEnvDraft.userAgent}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      userAgent: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                UA-CH JSON
                <textarea
                  rows={8}
                  className="code-area"
                  value={browserEnvDraft.userAgentMetadataText}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      userAgentMetadataText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                Viewport JSON
                <textarea
                  rows={7}
                  className="code-area"
                  value={browserEnvDraft.viewportText}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      viewportText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                Screen JSON
                <textarea
                  rows={7}
                  className="code-area"
                  value={browserEnvDraft.screenText}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      screenText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                Geolocation JSON
                <textarea
                  rows={6}
                  className="code-area"
                  value={browserEnvDraft.geolocationText}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      geolocationText: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                描述
                <textarea
                  rows={5}
                  value={browserEnvDraft.description}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                />
              </label>
              <label>
                导入历史 fingerprint JSON
                <textarea
                  rows={8}
                  className="code-area"
                  value={browserEnvDraft.importJson}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setBrowserEnvDraft((current) => ({
                      ...current,
                      importJson: event.target.value
                    }))
                  }
                />
              </label>
              <div className="form-footer form-footer--split">
                {isEditMode ? (
                  <button
                    type="button"
                    className="accent-button"
                    onClick={handleBrowserEnvironmentSave}
                  >
                    保存浏览器环境
                  </button>
                ) : (
                  <p className="empty-copy">
                    查看模式下不允许修改字段。点击“切换到修改”后再保存。
                  </p>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleBrowserEnvironmentImport}
                  disabled={!isEditMode}
                >
                  导入历史 JSON
                </button>
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "profiles" ? (
            <SectionCard
              title={profileDraft.id ? `画像详情 · ${profileDraft.name || "未命名画像"}` : "新建画像"}
              subtitle="画像依旧保留 JSON 能力，但现在以标准台账维护，而不是散落在工具页里。"
              actions={
                <div className="panel-toolbar">
                  <StatusPill tone={panelModeTone(panelMode)}>{panelModeLabel(panelMode)}</StatusPill>
                  {!isEditMode && profileDraft.id ? (
                    <button type="button" className="ghost-button" onClick={() => setPanelMode("edit")}>
                      切换到修改
                    </button>
                  ) : null}
                  {profileCanDelete ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        handleProfileDelete({
                          id: profileDraft.id,
                          name: profileDraft.name
                        })
                      }
                    >
                      删除画像
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="detail-summary">
                <div>
                  <span>期望结果</span>
                  <strong>{profileDraft.expectedOutcomesText || "未设置"}</strong>
                  <p>用于判定流程是否触发挑战或进入成功态。</p>
                </div>
                <div>
                  <span>邮箱链路</span>
                  <strong>{profileDraft.enabled ? "已启用" : "已停用"}</strong>
                  <p>当前画像对验证码邮箱链路的要求。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  画像名称
                  <input
                    value={profileDraft.name}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  邮箱目录
                  <input
                    value={profileDraft.mailbox}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, mailbox: event.target.value }))
                    }
                  />
                </label>
                <label>
                  发件人过滤
                  <input
                    value={profileDraft.senderFilter}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, senderFilter: event.target.value }))
                    }
                  />
                </label>
                <label>
                  主题过滤
                  <input
                    value={profileDraft.subjectFilter}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, subjectFilter: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={profileDraft.enabled}
                  disabled={!isEditMode}
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
                  disabled={!isEditMode}
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
                  disabled={!isEditMode}
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
                  disabled={!isEditMode}
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
                  disabled={!isEditMode}
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
                  rows={5}
                  value={profileDraft.description}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setProfileDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="form-footer">
                {isEditMode ? (
                  <button type="button" className="accent-button" onClick={handleProfileSave}>
                    保存画像
                  </button>
                ) : (
                  <p className="empty-copy">查看模式下不允许修改字段。点击“切换到修改”后再保存。</p>
                )}
              </div>
            </SectionCard>
          ) : null}

          {activeTab === "mail" ? (
            <SectionCard
              title={mailDraft.id ? `邮箱详情 · ${mailDraft.name || "未命名邮箱配置"}` : "新建邮箱配置"}
              subtitle="邮箱配置既承担验证码链路，也承担平台健康度判断，所以单独保留在标准资源表里。"
              actions={
                <div className="panel-toolbar">
                  <StatusPill tone={panelModeTone(panelMode)}>{panelModeLabel(panelMode)}</StatusPill>
                  {!isEditMode && mailDraft.id ? (
                    <button type="button" className="ghost-button" onClick={() => setPanelMode("edit")}>
                      切换到修改
                    </button>
                  ) : null}
                  {mailCanDelete ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => handleMailDelete(mailDraft)}
                    >
                      删除邮箱
                    </button>
                  ) : null}
                </div>
              }
            >
              <div className="detail-summary">
                <div>
                  <span>接入模式</span>
                  <strong>{mailModeLabel(mailDraft.mode)}</strong>
                  <p>{readiness?.mailConfigs[mailDraft.id || ""]?.detail || "保存后可测试连接。"}</p>
                </div>
                <div>
                  <span>就绪状态</span>
                  <strong>{readiness?.mailConfigs[mailDraft.id || ""]?.label || "未校验"}</strong>
                  <p>用于判断邮箱链路是否满足运行前提。</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  配置名称
                  <input
                    value={mailDraft.name}
                    disabled={!isEditMode}
                    onChange={(event) =>
                      setMailDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  接入模式
                  <select
                    value={mailDraft.mode}
                    disabled={!isEditMode}
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
                  disabled={!isEditMode}
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
                      disabled={!isEditMode}
                      onChange={(event) =>
                        setMailDraft((current) => ({ ...current, baseUrl: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      value={mailDraft.apiKey}
                      disabled={!isEditMode}
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
                      disabled={!isEditMode}
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
                      disabled={!isEditMode}
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
                      disabled={!isEditMode}
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
                      disabled={!isEditMode}
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
                  rows={5}
                  value={mailDraft.description}
                  disabled={!isEditMode}
                  onChange={(event) =>
                    setMailDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="form-footer form-footer--split">
                {isEditMode ? (
                  <button type="button" className="accent-button" onClick={handleMailSave}>
                    保存邮箱配置
                  </button>
                ) : (
                  <p className="empty-copy">查看模式下不允许修改字段。点击“切换到修改”后再保存。</p>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleMailTest}
                  disabled={!mailDraft.id}
                >
                  测试连接
                </button>
              </div>
            </SectionCard>
          ) : null}
        </>
      </div>

      <DrawerPanel
        open={isQuickCreateOpen}
        title="快捷新建资源"
        subtitle="不用先切 tab，再新建。这里直接选择资源类型，系统会切到对应工作台并进入编辑模式。"
        onClose={() => setIsQuickCreateOpen(false)}
      >
        <div className="quick-create-grid">
          {tabButtons.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="quick-create-card"
              onClick={() => handleQuickCreate(tab.id)}
            >
              <div className="quick-create-card__header">
                <strong>{tab.label}</strong>
                <StatusPill tone={activeTab === tab.id ? "accent" : "neutral"}>
                  {tab.helper}
                </StatusPill>
              </div>
              <p>{quickCreateDescriptions[tab.id]}</p>
            </button>
          ))}
        </div>
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(pendingDeleteResource)}
        title={`确认删除${pendingDeleteResource?.name || "该资源"}吗？`}
        description={deleteResourceDescription}
        confirmLabel="确认删除"
        confirming={isDeletingResource}
        onConfirm={handleConfirmDeleteResource}
        onCancel={() => {
          if (!isDeletingResource) {
            setPendingDeleteResource(null);
          }
        }}
      />
    </div>
  );
}
