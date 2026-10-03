import type { Action, Timestamp } from "./common.js";

export type RunStatus = "running" | "ok" | "error" | "skipped";
export type RunSource = "schedule" | "webhook" | "manual";

export interface Schedule {
  /** e.g. `sch_1a2b3c4d5e6f`. */
  id: string;
  machineId: string;
  name: string;
  /** 5-field cron in UTC, or `@hourly`, `@daily`, `@weekly`, `@monthly`. */
  cron: string;
  timezone: "UTC";
  action: Action;
  wakeIfStopped: boolean;
  stopAfter: boolean;
  enabled: boolean;
  nextRunAt: Timestamp | null;
  lastRunAt: Timestamp | null;
  lastStatus: RunStatus | null;
  createdAt: Timestamp;
}

/** Create/update responses also include the next three run times. */
export interface ScheduleWithUpcoming extends Schedule {
  upcoming: Timestamp[];
}

export interface ScheduleCreateParams {
  /** Default `Scheduled job`. */
  name?: string;
  cron: string;
  action: Action;
  /** Default `true`. */
  wakeIfStopped?: boolean;
  /** Default `false`. */
  stopAfter?: boolean;
  /** Default `true`. */
  enabled?: boolean;
}

export type ScheduleUpdateParams = Partial<ScheduleCreateParams>;

export type WebhookMode = "sync" | "async";

export interface Webhook {
  /** e.g. `wh_1a2b3c4d5e6f`. */
  id: string;
  machineId: string;
  name: string;
  action: Action;
  mode: WebhookMode;
  wakeIfStopped: boolean;
  stopAfter: boolean;
  enabled: boolean;
  lastCalledAt: Timestamp | null;
  createdAt: Timestamp;
  /** The secret URL — only real in create/rotate responses; elsewhere a placeholder string. */
  url: string;
}

export interface WebhookCreateParams {
  /** Default `Webhook`. */
  name?: string;
  action: Action;
  /** Default `sync`. */
  mode?: WebhookMode;
  wakeIfStopped?: boolean;
  stopAfter?: boolean;
}

export interface WebhookUpdateParams {
  name?: string;
  action?: Action;
  mode?: WebhookMode;
  wakeIfStopped?: boolean;
  stopAfter?: boolean;
  enabled?: boolean;
}

/** Result of `schedules.run()` (and of a sync webhook call for shell/tool actions). */
export interface RunResult {
  runId: string;
  status: Exclude<RunStatus, "running">;
  output: string;
  /** For `http` actions: the in-machine app's response. */
  http?: { status: number; contentType: string; body: string };
}

export interface JobRun {
  /** e.g. `run_1a2b3c4d5e6f7a8b`. */
  id: string;
  source: RunSource;
  sourceId: string;
  status: RunStatus;
  /** Up to 16 KB. */
  output: string | null;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  durationMs: number | null;
}

export interface RunListParams {
  /** Default 50, max 200. */
  limit?: number;
}

export interface WebhookCallParams {
  /** Default `POST`. Webhooks accept any method. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-encoded unless it's a string. ≤ 1 MB. */
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}
