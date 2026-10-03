/**
 * Types shared by several resources. Owned by the core: other areas import from here but
 * should not need to change it.
 */

/** A machine id, or any object with one (e.g. a `Machine`). Accepted wherever a machine is expected. */
export type MachineRef = string | { id: string };

/** The id of a {@link MachineRef}. */
export const idOf = (m: MachineRef): string => (typeof m === "string" ? m : m.id);

/** Unix time in milliseconds. */
export type Timestamp = number;

/** Machine sizes: tiny (½ vCPU, 4 GB, 8 GB disk), small (1, 6, 12), medium (2, 8, 16), large (4, 12, 20). */
export type MachineSize = "tiny" | "small" | "medium" | "large";

/** `light` = Obscura (fast, stealthy, no WebGL); `full` = Chromium with software WebGL. */
export type BrowserMode = "light" | "full";

/** What happens when `expiresAt` is reached: `stop` keeps all state, `destroy` deletes the machine. */
export type OnExpire = "stop" | "destroy";

/** Free-form `key: value` strings (up to 20). Keys: 1–64 chars of letters, digits and `_ . : -`; values ≤ 256 chars. */
export type Labels = Record<string, string>;

export type VpnType = "proxy" | "unlock";

/** A machine's VPN location as returned by the API. */
export interface VpnSetting {
  type: VpnType;
  /** Two-letter country code, lowercase (e.g. `de`). */
  country: string;
  /** Lowercase city without spaces (e.g. `newyork`); only on networks with city targeting. */
  city?: string;
}

/**
 * VPN input. On create/claim, `country` is required and `type` defaults to `proxy`. On
 * `vpn.set()` fields left out keep their current value; `city: null` removes the city.
 */
export interface VpnInput {
  type?: VpnType;
  country?: string;
  city?: string | null;
}

/** An action run inside a machine by a scheduled job, webhook, or warm-pool template step. */
export type Action = ShellAction | ToolAction | HttpAction;

export interface ShellAction {
  type: "shell";
  /** Bash command run as the `agent` user (≤ 8000 chars). A non-zero exit fails the run. */
  command: string;
  /** Default 300, max 900. */
  timeoutSeconds?: number;
}

export interface ToolAction {
  type: "tool";
  /** Any machine MCP tool, e.g. `browser_navigate`, `apps_install`. */
  tool: string;
  arguments?: Record<string, unknown>;
  /** Webhooks only: merge the caller's JSON object body into `arguments`. */
  passInput?: boolean;
}

export interface HttpAction {
  type: "http";
  /** Port of an app inside the machine (1–65535, not 7000). Works for apps bound to 127.0.0.1. */
  port: number;
  /** Default `/`. */
  path?: string;
  /** Default `POST`. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
}

/** `{ id, deleted: true }` returned by most DELETE endpoints. */
export interface DeletedResponse {
  id: string;
  deleted: true;
}
