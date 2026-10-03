import type { Labels, MachineSize, Timestamp } from "./common.js";
import type { MachineStatus } from "./machines.js";
import type { RunSource, RunStatus } from "./automations.js";

export type EventType =
  | "machine.created"
  | "machine.started"
  | "machine.stopped"
  | "machine.error"
  | "machine.expired"
  | "machine.destroyed"
  | "machine.claimed"
  | "run.succeeded"
  | "run.failed";

/** What an endpoint subscribes to: specific types or `"*"` for all. */
export type EventSubscription = EventType | "*";

export interface EventEndpoint {
  /** e.g. `ep_1a2b3c4d5e6f`. */
  id: string;
  url: string;
  description: string | null;
  events: EventSubscription[];
  enabled: boolean;
  createdAt: Timestamp;
}

/** Create and rotate-secret responses include the signing secret, shown once. */
export interface EventEndpointWithSecret extends EventEndpoint {
  /** `whsec_…` */
  secret: string;
}

export interface EventEndpointCreateParams {
  /** HTTPS URL. */
  url: string;
  /** Default `["*"]`. */
  events?: EventSubscription[];
  /** ≤ 120 chars. */
  description?: string;
}

export interface EventEndpointUpdateParams {
  url?: string;
  events?: EventSubscription[];
  description?: string;
  /** `false` pauses deliveries. */
  enabled?: boolean;
}

export interface EventEndpointTestResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface EventDelivery {
  /** e.g. `dlv_5c1e0a9b2d4f6e81`. */
  id: string;
  endpointId: string;
  eventId: string;
  type: EventType | "test";
  status: DeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  createdAt: Timestamp;
  deliveredAt: Timestamp | null;
}

export interface DeliveryListParams {
  /** Only deliveries to this endpoint id. */
  endpoint?: string;
  /** Default 50, max 200. */
  limit?: number;
}

/** Machine summary inside `machine.*` event payloads. */
export interface EventMachine {
  id: string;
  name: string;
  status: MachineStatus | "destroyed";
  size: MachineSize;
  externalId: string | null;
  labels: Labels;
}

export interface MachineEventData {
  machine: EventMachine;
  /** e.g. `{ reason: "expired" }` for `machine.stopped`, `{ poolId }` for `machine.claimed`. */
  detail: Record<string, unknown> | string | null;
}

export interface RunEventData {
  run: { id: string; source: RunSource; sourceId: string; status: Exclude<RunStatus, "running" | "skipped">; output: string };
  machine: { id: string; name: string; externalId: string | null; labels: Labels };
}

interface BaseEvent<T extends string, D> {
  /** `evt_…` — use it to deduplicate. */
  id: string;
  type: T;
  /** ISO 8601 — use it to order. */
  createdAt: string;
  data: D;
}

/** A verified event webhook payload. */
export type BurrowboxEvent =
  | BaseEvent<
      "machine.created" | "machine.started" | "machine.stopped" | "machine.error" | "machine.expired" | "machine.destroyed" | "machine.claimed",
      MachineEventData
    >
  | BaseEvent<"run.succeeded" | "run.failed", RunEventData>
  | BaseEvent<"test", { message: string }>;

export interface VerifySignatureOptions {
  /** Reject timestamps older (or newer) than this. Default 300 seconds. */
  toleranceSeconds?: number;
  /** Current time in unix seconds (for tests). Default: now. */
  now?: number;
}
