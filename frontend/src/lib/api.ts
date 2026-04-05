import type {
  ArtifactEntry,
  CaseRecord,
  MailConfigResource,
  MailTestResult,
  OverviewData,
  PlanResource,
  PlatformState,
  ProfileResource,
  ReadinessMap,
  RunRecord,
  SiteResource,
  SystemSettings,
  TaskRecord
} from "./types";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
};

interface RunSnapshot {
  status: string;
  mode: string;
  pid: number | null;
  platformRunId: string | null;
  command: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  reportAvailable: boolean;
  logs: { at: string; stream: string; text: string }[];
  summary: string;
  latestStage: {
    stageLabel: string;
    outcomeKind: string;
    url: string;
    details: string;
  } | null;
  insight: {
    type: string;
    title: string;
    message: string;
    action: string;
  } | null;
  conclusion: {
    tone: string;
    title: string;
    summary: string;
    detail: string;
    action: string;
  } | null;
}

async function requestJson<T>(input: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  let body = options.body ?? null;

  if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(input, {
    ...options,
    headers,
    body
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || `Request failed: ${response.status}`);
  }

  return payload as T;
}

export const api = {
  async getOverview() {
    const payload = await requestJson<{ ok: true; overview: OverviewData }>("/api/platform/overview");
    return payload.overview;
  },

  async getState() {
    const payload = await requestJson<{
      ok: true;
      state: PlatformState;
      readiness: ReadinessMap;
    }>("/api/platform/state");
    return payload;
  },

  async saveSite(site: SiteResource) {
    const method = site.id ? "PUT" : "POST";
    const target = site.id ? `/api/platform/sites/${site.id}` : "/api/platform/sites";
    const payload = await requestJson<{ ok: true; site: SiteResource }>(target, {
      method,
      body: site
    });
    return payload.site;
  },

  async deleteSite(siteId: string) {
    const payload = await requestJson<{ ok: true; site: SiteResource }>(
      `/api/platform/sites/${siteId}`,
      { method: "DELETE" }
    );
    return payload.site;
  },

  async savePlan(plan: PlanResource) {
    const method = plan.id ? "PUT" : "POST";
    const target = plan.id ? `/api/platform/plans/${plan.id}` : "/api/platform/plans";
    const payload = await requestJson<{ ok: true; plan: PlanResource }>(target, {
      method,
      body: plan
    });
    return payload.plan;
  },

  async saveProfile(profile: ProfileResource) {
    const method = profile.id ? "PUT" : "POST";
    const target = profile.id ? `/api/platform/profiles/${profile.id}` : "/api/platform/profiles";
    const payload = await requestJson<{ ok: true; profile: ProfileResource }>(target, {
      method,
      body: profile
    });
    return payload.profile;
  },

  async saveMailConfig(mailConfig: MailConfigResource) {
    const method = mailConfig.id ? "PUT" : "POST";
    const target = mailConfig.id
      ? `/api/platform/mail-configs/${mailConfig.id}`
      : "/api/platform/mail-configs";
    const payload = await requestJson<{ ok: true; mailConfig: MailConfigResource }>(target, {
      method,
      body: mailConfig
    });
    return payload.mailConfig;
  },

  async testMailConfig(mailConfigId: string) {
    const payload = await requestJson<{ ok: true; result: MailTestResult }>(
      `/api/platform/mail-configs/${mailConfigId}/test`,
      { method: "POST" }
    );
    return payload.result;
  },

  async getRuns() {
    const payload = await requestJson<{
      ok: true;
      runs: RunRecord[];
      activeRunId: string | null;
    }>("/api/platform/runs");
    return payload;
  },

  async getTasks() {
    const payload = await requestJson<{ ok: true; tasks: TaskRecord[] }>("/api/platform/tasks");
    return payload.tasks;
  },

  async getCases(taskId?: string) {
    const params = new URLSearchParams();
    if (taskId) {
      params.set("taskId", taskId);
    }

    const query = params.toString();
    const payload = await requestJson<{ ok: true; cases: CaseRecord[] }>(
      `/api/platform/cases${query ? `?${query}` : ""}`
    );
    return payload.cases;
  },

  async getRun(runId: string) {
    const payload = await requestJson<{ ok: true; run: RunRecord }>(`/api/platform/runs/${runId}`);
    return payload.run;
  },

  async startRun(planId: string, mode: "headless" | "headed", runCount: number) {
    const payload = await requestJson<{ ok: true; run: RunSnapshot }>("/api/platform/runs", {
      method: "POST",
      body: { planId, mode, runCount }
    });
    return payload.run;
  },

  async stopRun() {
    const payload = await requestJson<{ ok: true; run: RunSnapshot }>("/api/platform/runs/stop", {
      method: "POST"
    });
    return payload.run;
  },

  async getArtifacts(filters: { runId?: string; taskId?: string; caseId?: string; type?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.runId) {
      params.set("runId", filters.runId);
    }
    if (filters.taskId) {
      params.set("taskId", filters.taskId);
    }
    if (filters.caseId) {
      params.set("caseId", filters.caseId);
    }
    if (filters.type) {
      params.set("type", filters.type);
    }

    const query = params.toString();
    const payload = await requestJson<{ ok: true; artifacts: ArtifactEntry[] }>(
      `/api/platform/artifacts${query ? `?${query}` : ""}`
    );
    return payload.artifacts;
  },

  async getSystem() {
    const payload = await requestJson<{ ok: true; system: SystemSettings }>("/api/platform/system");
    return payload.system;
  },

  async updateSystem(system: Partial<SystemSettings>) {
    const payload = await requestJson<{ ok: true; system: SystemSettings }>("/api/platform/system", {
      method: "PUT",
      body: system
    });
    return payload.system;
  }
};
