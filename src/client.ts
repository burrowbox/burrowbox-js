import { HttpClient, type FetchLike, type HttpRequest } from "./http.js";
import { Machines } from "./resources/machines.js";
import { Mcp } from "./resources/mcp.js";
import { LiveView } from "./resources/live-view.js";
import { Vault } from "./resources/vault.js";
import { Pools } from "./resources/pools.js";
import { Automations } from "./resources/automations.js";
import { Events } from "./resources/events.js";
import { Billing } from "./resources/billing.js";
import { Account } from "./resources/account.js";
import { Vpn } from "./resources/vpn.js";

export const DEFAULT_BASE_URL = "https://burrowbox.dev";
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_RETRIES = 2;

export interface BurrowboxOptions {
  /**
   * An API key (`tmk_…`, full account access) or a machine token (`tmm_…`, only that machine's MCP
   * and live-view endpoints). Defaults to `process.env.BURROWBOX_KEY` where `process` exists.
   */
  apiKey?: string;
  /** Default `process.env.BURROWBOX_BASE_URL` or `https://burrowbox.dev`. */
  baseUrl?: string;
  /** Custom fetch (e.g. for proxies or tests). Default: the global `fetch`. */
  fetch?: FetchLike;
  /** Per-request timeout. Default 60 000 ms (slow calls like create/start/resize use at least 180 000 ms). */
  timeoutMs?: number;
  /** Retries for idempotent requests on 408/429/5xx/network errors. Default 2. */
  maxRetries?: number;
  /** Headers added to every request. */
  defaultHeaders?: Record<string, string>;
}

function env(name: string): string | undefined {
  try {
    const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    const v = p?.env?.[name];
    return v && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined; // e.g. Deno without --allow-env
  }
}

/**
 * The Burrowbox API client.
 *
 * ```ts
 * import { Burrowbox } from "burrowbox";
 * const bb = new Burrowbox(); // reads BURROWBOX_KEY
 * const machine = await bb.machines.create({ name: "research-bot", ttlMinutes: 60 });
 * ```
 */
export class Burrowbox {
  static readonly DEFAULT_BASE_URL = DEFAULT_BASE_URL;

  /** The shared HTTP layer (also usable directly for endpoints this SDK doesn't wrap yet). */
  readonly http: HttpClient;

  readonly machines: Machines;
  readonly mcp: Mcp;
  readonly liveView: LiveView;
  readonly vault: Vault;
  readonly pools: Pools;
  readonly automations: Automations;
  readonly events: Events;
  readonly billing: Billing;
  readonly account: Account;
  readonly vpn: Vpn;

  constructor(options: BurrowboxOptions = {}) {
    const fetchImpl: FetchLike | undefined =
      options.fetch ?? (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new Error("No global fetch found. Use Node 18+, or pass `fetch` to new Burrowbox({ fetch }).");
    }
    this.http = new HttpClient({
      baseUrl: options.baseUrl ?? env("BURROWBOX_BASE_URL") ?? DEFAULT_BASE_URL,
      apiKey: options.apiKey ?? env("BURROWBOX_KEY"),
      fetch: fetchImpl,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      defaultHeaders: options.defaultHeaders,
    });

    this.machines = new Machines(this);
    this.mcp = new Mcp(this);
    this.liveView = new LiveView(this);
    this.vault = new Vault(this);
    this.pools = new Pools(this);
    this.automations = new Automations(this);
    this.events = new Events(this);
    this.billing = new Billing(this);
    this.account = new Account(this);
    this.vpn = new Vpn(this);
  }

  /** The bearer token in use (`tmk_…` or `tmm_…`), if any. */
  get apiKey(): string | undefined {
    return this.http.apiKey;
  }

  /** e.g. `https://burrowbox.dev` (no trailing slash). */
  get baseUrl(): string {
    return this.http.baseUrl;
  }

  /** Low-level escape hatch: an authenticated request to any API path. */
  request<T = unknown>(req: HttpRequest): Promise<T> {
    return this.http.request<T>(req);
  }
}
