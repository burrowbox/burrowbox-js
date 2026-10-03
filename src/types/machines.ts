import type { BrowserMode, Labels, MachineSize, OnExpire, Timestamp, VpnInput, VpnSetting } from "./common.js";

export type MachineStatus = "creating" | "starting" | "running" | "stopping" | "stopped" | "error";

/** The machine object (`GET /api/machines/{id}`). */
export interface Machine {
  /** Hex id, e.g. `2f6aeedcd3`. */
  id: string;
  ownerId: string | null;
  name: string;
  status: MachineStatus;
  size: MachineSize;
  /** `WIDTHxHEIGHT`, e.g. `1440x900`. */
  screen: string;
  /** When `onExpire` applies. `null` = always on. */
  expiresAt: Timestamp | null;
  expiresInSeconds: number | null;
  onExpire: OnExpire;
  /** `snapshot` (saved on stop) or `crashed` (restores from the last save point). */
  lastStopMode: "snapshot" | "crashed" | string | null;
  lastError: string | null;
  vpn: VpnSetting | null;
  browser: BrowserMode;
  agentVersion: string | null;
  updateAvailable: boolean;
  autoUpdate: boolean;
  /** Your own id for the machine, usually your customer's id. */
  externalId: string | null;
  labels: Labels;
  /** The warm pool it was claimed from. */
  poolId: string | null;
  /** `true` while idle in a warm pool (only listed with `includePooled`). */
  pooled: boolean;
  /** Machine MCP endpoint: `https://burrowbox.dev/api/machines/{id}/mcp`. */
  mcpUrl: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Returned by create, get and pool claim: the machine plus its scoped `tmm_` token. */
export interface MachineWithToken extends Machine {
  /** Machine token (`tmm_…`): only works on this machine's MCP and live-view endpoints. */
  mcpToken: string;
}

export interface MachineCreateParams {
  /** Up to 48 characters. Default: generated. */
  name?: string;
  /** Default `tiny`. */
  size?: MachineSize;
  /** `WIDTHxHEIGHT`. Default `1440x900`. */
  screen?: string;
  /** Keep on for this long, then apply `onExpire`. Default: always on. */
  ttlMinutes?: number;
  /** Default `stop`. */
  onExpire?: OnExpire;
  /** Your customer's id (≤ 128 chars). */
  externalId?: string;
  labels?: Labels;
  /** Default `light`. */
  browser?: BrowserMode;
  /** VPN location (billed extra). */
  vpn?: VpnInput & { country: string };
}

export interface MachineListParams {
  /** Only machines tagged with this customer id. */
  externalId?: string;
  /** Only machines whose labels include all of these (sent as `label.<key>=<value>`). */
  labels?: Labels;
  /** Also list idle warm-pool machines (hidden by default). */
  includePooled?: boolean;
}

export interface MachineUpdateParams {
  name?: string;
  /** New deadline from now; `null` = always on. */
  ttlMinutes?: number | null;
  onExpire?: OnExpire;
  /** `null` clears it. */
  externalId?: string | null;
  /** Replaces the whole set; `null` clears it. */
  labels?: Labels | null;
  /** `false` pins the machine's agent version. */
  autoUpdate?: boolean;
  /** Switch the browser (live on a running machine). */
  browser?: BrowserMode;
  /** Change the size (a running machine restarts once, ~10 s). */
  size?: MachineSize;
}

export interface MachineStartParams {
  /** Set a new deadline (minutes from now). */
  ttlMinutes?: number;
}

export interface MachineUpdateAgentParams {
  /** Allow a save + restart + restore on machines that can't update live. Default `true`. */
  restart?: boolean;
}

export interface AgentUpdateResult {
  mode: "current" | "live" | "installed" | "restarted" | "pending";
  from: string | null;
  to: string;
  migrations?: string;
}

export interface MachineAgentUpdateResponse extends Machine {
  update: AgentUpdateResult;
}

/** Response of browser and VPN changes: the machine, and whether it was applied live. */
export interface MachineAppliedResponse extends Machine {
  /** `true` when the change took effect on the running machine. */
  applied: boolean;
  /** e.g. "takes effect when the machine starts". */
  note?: string;
}

export interface BrowserCapabilities {
  engine?: string;
  userAgent?: string | null;
  webgl?: boolean;
  webgl2?: boolean;
  renderer?: string;
  error?: string;
  [key: string]: unknown;
}

export interface MachineBrowserInfo {
  browser: BrowserMode;
  /** What the running browser supports; `null` when the machine isn't running. */
  capabilities: BrowserCapabilities | null;
}

export interface MachineDestroyResponse {
  id: string;
  destroyed: true;
}

/** One entry of the lifecycle log (`created`, `started`, `stopped`, `expired`, `error`, `updated`, `resized`…). */
export interface MachineEvent {
  at: Timestamp;
  type: string;
  detail?: unknown;
}

export interface ScreenshotParams {
  /** JPEG quality 1–100. Server default 55. */
  quality?: number;
}

export interface DesktopApp {
  id: string;
  name: string;
  exec: string;
  comment?: string;
  icon?: string;
  file: string;
}

export interface LaunchAppParams {
  /** Installed app id or name (fuzzy). */
  app?: string;
  /** Or a command line. */
  command?: string;
  cwd?: string;
}

export interface DesktopWindow {
  /** X11 window id, e.g. `0x00800003`. */
  id: string;
  pid: number;
  class: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  focused: boolean;
}

export interface LaunchAppResult {
  pid?: number;
  window?: DesktopWindow;
  command: string;
}

export interface WaitForStatusOptions {
  /** Give up after this long. Default 120 000 ms. */
  timeoutMs?: number;
  /** Poll interval. Default 2000 ms. */
  intervalMs?: number;
  signal?: AbortSignal;
}
