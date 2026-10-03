import { APIResource } from "../resource.js";
import { path, type Query, type RequestOptions } from "../http.js";
import { BurrowboxError, TimeoutError } from "../errors.js";
import { idOf, type BrowserMode, type MachineRef, type MachineSize } from "../types/common.js";
import type {
  DesktopApp,
  DesktopWindow,
  LaunchAppParams,
  LaunchAppResult,
  Machine,
  MachineAgentUpdateResponse,
  MachineAppliedResponse,
  MachineBrowserInfo,
  MachineCreateParams,
  MachineDestroyResponse,
  MachineEvent,
  MachineListParams,
  MachineStartParams,
  MachineStatus,
  MachineUpdateAgentParams,
  MachineUpdateParams,
  MachineWithToken,
  ScreenshotParams,
  WaitForStatusOptions,
} from "../types/machines.js";
import type { MachineMcpOptions, McpServerConfig } from "../types/mcp.js";
import type { LiveViewCreateParams, LiveViewLink } from "../types/live-view.js";

/** Long-running calls (boot, resize, save + restart) get at least this long. */
const SLOW_MS = 180_000;
const slow = (o?: RequestOptions): RequestOptions => ({ ...o, timeoutMs: o?.timeoutMs ?? SLOW_MS });

/**
 * Machines: isolated Linux computers with their own disk, desktop, browser and MCP endpoint.
 * `client.machines`.
 */
export class Machines extends APIResource {
  /**
   * Create and boot a machine. Resolves once it's running (usually 1–3 s), with its `mcpToken`.
   * `POST /api/machines` → 201. Throws `InsufficientCreditError` (402) without credit/card and
   * `RateLimitError` (429) at the account's machine limit.
   */
  create(params: MachineCreateParams = {}, options?: RequestOptions): Promise<MachineWithToken> {
    return this._http.post<MachineWithToken>("/api/machines", params, slow(options));
  }

  /** Your machines, newest first. `GET /api/machines?externalId=&label.<k>=<v>&includePooled=1` */
  list(params: MachineListParams = {}, options?: RequestOptions): Promise<Machine[]> {
    const query: Query = {};
    if (params.externalId !== undefined) query.externalId = params.externalId;
    for (const [k, v] of Object.entries(params.labels ?? {})) query[`label.${k}`] = v;
    if (params.includePooled) query.includePooled = 1;
    return this._http.get<Machine[]>("/api/machines", query, options);
  }

  /** One machine, including its `mcpToken`. `GET /api/machines/{id}` */
  get(machine: MachineRef, options?: RequestOptions): Promise<MachineWithToken> {
    return this._http.get<MachineWithToken>(path`/api/machines/${idOf(machine)}`, undefined, options);
  }

  /**
   * Change name, schedule (`ttlMinutes`, `onExpire`), tags, `autoUpdate`, `browser` or `size`.
   * `PATCH /api/machines/{id}`
   */
  update(machine: MachineRef, params: MachineUpdateParams, options?: RequestOptions): Promise<Machine> {
    const slowCall = params.size !== undefined || params.browser !== undefined;
    return this._http.patch<Machine>(path`/api/machines/${idOf(machine)}`, params, slowCall ? slow(options) : options);
  }

  /**
   * Set how long the machine stays on from now (`null` = always on), and optionally what happens
   * then. Shorthand for `update(id, { ttlMinutes, onExpire })`.
   */
  schedule(
    machine: MachineRef,
    ttlMinutes: number | null,
    onExpire?: MachineUpdateParams["onExpire"],
    options?: RequestOptions,
  ): Promise<Machine> {
    return this.update(machine, onExpire ? { ttlMinutes, onExpire } : { ttlMinutes }, options);
  }

  /** Turn a stopped machine on; it resumes from its saved state. `POST /api/machines/{id}/start` */
  start(machine: MachineRef, params: MachineStartParams = {}, options?: RequestOptions): Promise<Machine> {
    return this._http.post<Machine>(path`/api/machines/${idOf(machine)}/start`, params, slow(options));
  }

  /** Save the whole filesystem and turn the machine off. `POST /api/machines/{id}/stop` */
  stop(machine: MachineRef, options?: RequestOptions): Promise<Machine> {
    return this._http.post<Machine>(path`/api/machines/${idOf(machine)}/stop`, {}, slow(options));
  }

  /** Permanently delete the machine and everything on it. `DELETE /api/machines/{id}` */
  destroy(machine: MachineRef, options?: RequestOptions): Promise<MachineDestroyResponse> {
    // Not retried: a retry after a lost response would 404.
    return this._http.request<MachineDestroyResponse>({
      ...slow(options),
      method: "DELETE",
      path: path`/api/machines/${idOf(machine)}`,
      idempotent: false,
    });
  }

  /** Alias of {@link destroy}. */
  delete(machine: MachineRef, options?: RequestOptions): Promise<MachineDestroyResponse> {
    return this.destroy(machine, options);
  }

  /**
   * Change the size without recreating. A running machine is saved, restarted on the new size and
   * restored (~10 s). `POST /api/machines/{id}/resize`
   */
  resize(machine: MachineRef, size: MachineSize, options?: RequestOptions): Promise<Machine> {
    return this._http.post<Machine>(path`/api/machines/${idOf(machine)}/resize`, { size }, slow(options));
  }

  /** Switch the browser engine (live on a running machine). `PUT /api/machines/{id}/browser` */
  setBrowser(machine: MachineRef, browser: BrowserMode, options?: RequestOptions): Promise<MachineAppliedResponse> {
    return this._http.put<MachineAppliedResponse>(path`/api/machines/${idOf(machine)}/browser`, { browser }, slow(options));
  }

  /** Browser mode and what the running browser supports. `GET /api/machines/{id}/browser` */
  getBrowser(machine: MachineRef, options?: RequestOptions): Promise<MachineBrowserInfo> {
    return this._http.get<MachineBrowserInfo>(path`/api/machines/${idOf(machine)}/browser`, undefined, options);
  }

  /** Update the machine's agent to the latest release (live when possible). `POST /api/machines/{id}/update` */
  updateAgent(machine: MachineRef, params: MachineUpdateAgentParams = {}, options?: RequestOptions): Promise<MachineAgentUpdateResponse> {
    return this._http.post<MachineAgentUpdateResponse>(path`/api/machines/${idOf(machine)}/update`, params, slow(options));
  }

  /** Lifecycle log, newest first (last 100). `GET /api/machines/{id}/events` */
  events(machine: MachineRef, options?: RequestOptions): Promise<MachineEvent[]> {
    return this._http.get<MachineEvent[]>(path`/api/machines/${idOf(machine)}/events`, undefined, options);
  }

  /** JPEG of the desktop (running machines only). `GET /api/machines/{id}/screenshot.jpg?q=` */
  screenshot(machine: MachineRef, params: ScreenshotParams = {}, options?: RequestOptions): Promise<Uint8Array> {
    return this._http.request<Uint8Array>({
      ...options,
      method: "GET",
      path: path`/api/machines/${idOf(machine)}/screenshot.jpg`,
      query: { q: params.quality },
      headers: { accept: "image/jpeg", ...options?.headers },
      responseType: "bytes",
    });
  }

  /** PNG of the browser's current page (running machines only). `GET /api/machines/{id}/browser/screenshot.png` */
  browserScreenshot(machine: MachineRef, options?: RequestOptions): Promise<Uint8Array> {
    return this._http.request<Uint8Array>({
      ...options,
      method: "GET",
      path: path`/api/machines/${idOf(machine)}/browser/screenshot.png`,
      headers: { accept: "image/png", ...options?.headers },
      responseType: "bytes",
    });
  }

  /** Installed desktop applications (running machines only). `GET /api/machines/{id}/apps` */
  apps(machine: MachineRef, options?: RequestOptions): Promise<DesktopApp[]> {
    return this._http.get<DesktopApp[]>(path`/api/machines/${idOf(machine)}/apps`, undefined, options);
  }

  /** Launch an app or command and wait for its window. `POST /api/machines/{id}/apps/launch` */
  launchApp(machine: MachineRef, params: LaunchAppParams, options?: RequestOptions): Promise<LaunchAppResult> {
    return this._http.post<LaunchAppResult>(path`/api/machines/${idOf(machine)}/apps/launch`, params, options);
  }

  /** Open windows with their geometry (running machines only). `GET /api/machines/{id}/windows` */
  windows(machine: MachineRef, options?: RequestOptions): Promise<DesktopWindow[]> {
    return this._http.get<DesktopWindow[]>(path`/api/machines/${idOf(machine)}/windows`, undefined, options);
  }

  /**
   * Poll `get()` until the machine reaches `status` (default `running`). Throws `TimeoutError`
   * after `timeoutMs`, or a `BurrowboxError` if the machine lands in `error` while waiting for another status.
   */
  async waitForStatus(
    machine: MachineRef,
    status: MachineStatus | MachineStatus[] = "running",
    opts: WaitForStatusOptions = {},
  ): Promise<MachineWithToken> {
    const want = Array.isArray(status) ? status : [status];
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const intervalMs = opts.intervalMs ?? 2_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const m = await this.get(machine, opts.signal ? { signal: opts.signal } : undefined);
      if (want.includes(m.status)) return m;
      if (m.status === "error") {
        throw new BurrowboxError(`Machine ${m.id} is in error: ${m.lastError ?? "unknown error"}`, { code: "api_error", body: m });
      }
      if (Date.now() + intervalMs > deadline) {
        throw new TimeoutError(`Machine ${m.id} is ${m.status}, not ${want.join("/")}, after ${timeoutMs} ms`);
      }
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, intervalMs);
        opts.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(opts.signal?.reason);
          },
          { once: true },
        );
      });
    }
  }

  /**
   * MCP connection details for this machine, ready for the Claude Agent SDK, the Messages API MCP
   * connector or any Streamable HTTP client. Uses the machine's scoped `mcpToken` (fetched with
   * `get()` when you pass only an id). Same as `client.mcp.machine()`.
   */
  mcp(machine: string | { id: string; mcpToken?: string }, opts?: MachineMcpOptions, options?: RequestOptions): Promise<McpServerConfig> {
    return this._client.mcp.machine(machine, opts, options);
  }

  /**
   * A short-lived, signed link to watch (or take over) the machine in an `<iframe>`.
   * Same as `client.liveView.create()`. `POST /api/machines/{id}/live-view`
   */
  liveView(machine: MachineRef, params?: LiveViewCreateParams, options?: RequestOptions): Promise<LiveViewLink> {
    return this._client.liveView.create(machine, params, options);
  }
}
