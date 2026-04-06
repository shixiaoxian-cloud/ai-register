export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "alert";
export type RunMode = "headless" | "headed";
export type RunStatus = "idle" | "running" | "stopping" | "passed" | "failed" | "stopped";

export interface SiteResource {
  id?: string;
  name: string;
  description: string;
  startUrl: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlanResource {
  id?: string;
  name: string;
  description: string;
  siteId: string;
  profileId: string;
  mailConfigId: string;
  runMode: RunMode;
  continueAfterProtectedChallenge: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailVerificationSettings {
  enabled: boolean;
  mailbox?: string;
  fromIncludes?: string;
  subjectIncludes?: string;
  senderFilter?: string;
  subjectFilter?: string;
  codePattern?: string;
}

export interface ProfileResource {
  id?: string;
  name: string;
  description: string;
  expectedOutcomes: string[];
  grantedPermissions: string[];
  selectors: Record<string, string>;
  emailVerification: EmailVerificationSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface MailConfigResource {
  id?: string;
  name: string;
  description: string;
  mode: "temp-mail" | "imap";
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PreferredLandingPage = "overview" | "runs" | "config";

export interface SystemSettings {
  defaultRunMode: RunMode;
  continueAfterProtectedChallenge: boolean;
  preferredLandingPage: PreferredLandingPage;
  notes: string;
  updatedAt?: string;
}

export interface PlatformState {
  selectedSiteId: string;
  selectedPlanId: string;
  selectedProfileId: string;
  selectedMailConfigId: string;
  sites: SiteResource[];
  plans: PlanResource[];
  profiles: ProfileResource[];
  mailConfigs: MailConfigResource[];
  system: SystemSettings;
  updatedAt: string;
}

export interface ReadinessMap {
  mailConfigs: Record<
    string,
    {
      ready: boolean;
      label: string;
      detail: string;
    }
  >;
}

export interface HealthCard {
  id: string;
  label: string;
  tone: Tone;
  detail: string;
}

export interface RunStageSnapshot {
  stageLabel: string;
  outcomeKind: string;
  url: string;
  details: string;
}

export interface RunInsight {
  type: string;
  title: string;
  message: string;
  action: string;
}

export interface RunConclusion {
  tone: Tone;
  title: string;
  summary: string;
  detail: string;
  action: string;
}

export interface LogEntry {
  at: string;
  stream: string;
  text: string;
}

export interface RunRecord {
  id: string;
  taskId?: string;
  caseId?: string;
  planId: string;
  planName: string;
  siteId: string;
  siteName: string;
  profileId: string;
  mailConfigId: string | null;
  status: RunStatus;
  mode: RunMode;
  summary: string;
  command: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  logs: LogEntry[];
  latestStage: RunStageSnapshot | null;
  insight: RunInsight | null;
  conclusion: RunConclusion | null;
  artifactKeys: string[];
  reportAvailable: boolean;
  pid?: number | null;
}

export interface TaskRecord {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  sourceKind: string;
  sourceRef: string;
  planId: string;
  planName: string;
  siteName: string;
  runMode: RunMode;
  totalCases: number;
  completedCases: number;
  successCases: number;
  failedCases: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  caseCount?: number;
  runCount?: number;
  artifactCount?: number;
  cases?: CaseRecord[];
  artifacts?: ArtifactSummary;
}

export interface TaskMutation {
  id?: string;
  name: string;
  status: TaskRecord["status"];
  sourceKind?: string;
  sourceRef?: string;
}

export interface ArtifactSummary {
  token: number;
  report: number;
  screenshot: number;
  trace: number;
  other: number;
}

export interface CaseRecord {
  id: string;
  taskId: string;
  name: string;
  sequence: number;
  status: 'pending' | 'running' | 'retrying' | 'success' | 'failed' | 'stopped';
  sourceKind: string;
  sourceRef: string;
  startedAt?: string;
  finishedAt?: string;
  retryCount: number;
  maxRetries: number;
  exitCode?: number;
  errorType?: 'timeout' | 'protection' | 'network' | 'unknown';
  errorMessage?: string;
  errorStack?: string;
  createdAt: string;
  updatedAt: string;
  runCount?: number;
  artifactCount?: number;
  runs?: RunRecord[];
  artifacts?: ArtifactEntry[];
  latestStage?: RunStageSnapshot;
}

export interface OverviewData {
  summary: {
    siteCount: number;
    planCount: number;
    profileCount: number;
    mailConfigCount: number;
    artifactCount: number;
    readySites: number;
    readyMailConfigs: number;
    reportCount: number;
    tokenCount: number;
    failedRuns: number;
    activeRunStatus: string;
  };
  health: HealthCard[];
  recentRuns: RunRecord[];
  featuredSite: SiteResource | null;
  featuredPlan: PlanResource | null;
  system: SystemSettings;
  updatedAt: string;
}

export interface ArtifactEntry {
  id: string;
  bucket: string;
  type: string;
  name: string;
  relPath: string;
  absolutePath: string;
  modifiedAt: string;
  sizeBytes: number;
  href: string;
  runId: string | null;
  taskId?: string | null;
  caseId?: string | null;
  isSensitive?: boolean;
  contentType?: string;
  storageKind?: string;
}

export interface MailTestResult {
  success: boolean;
  message: string;
  mode: string;
  testEmail?: string;
}
