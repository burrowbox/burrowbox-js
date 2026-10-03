# burrowbox: API contract

This is the public surface of the `burrowbox` npm package (v0.1.0). Implementations, tests and
examples follow it exactly: method names, argument order, types and the REST endpoint each
method calls. Types live in `src/types/<area>.ts` and are exported from the package root.

- **Implemented:** client, HTTP layer, errors, `machines`, `mcp`.
- **Stubbed** (signatures fixed; bodies `throw new Error("… is not implemented yet")`): `liveView`,
  `vault`, `pools`, `automations`, `events` + webhook signatures, `billing`, `account`, `vpn`.

Server ground truth: the Burrowbox API (`packages/api/src/index.ts`). Where the public docs and the
server differ, this contract follows the server (see [Doc/server differences](#docserver-differences)).

---

## Conventions (all resources)

- Every method returns a `Promise` (except `mcp.platform()` and the pure helper functions).
- **Machine arguments** are `MachineRef = string | { id: string }`, so a machine object works
  wherever an id does. Resolve with `idOf(ref)` from `src/types/common.ts`.
- **Last argument** of every HTTP-calling method is optional `options?: RequestOptions`:
  ```ts
  interface RequestOptions { timeoutMs?: number; maxRetries?: number; signal?: AbortSignal; headers?: Record<string, string> }
  ```
- **Paths** are built with the `path` tagged template (URL-encodes each value):
  ``this._http.get<T>(path`/api/machines/${idOf(machine)}/vault`, undefined, options)``.
- **Request bodies** are camelCase JSON exactly as the REST API takes them. Responses are returned
  as parsed JSON, unmodified (no envelope, no renaming).
- **Optional params objects** default to `{}`; POST bodies send `{}` when there are no params.
- **Retries:** GET/HEAD/PUT/DELETE retry on 408/429/5xx/network errors (`maxRetries`, default 2);
  POST/PATCH never retry unless the request passes `idempotent: true`.
- **Slow endpoints** (boot, resize, run-now, claim) pass a longer `timeoutMs` default, but always
  let `options.timeoutMs` override it: `{ ...options, timeoutMs: options?.timeoutMs ?? N }`.
- **Amounts:** `…Micros` = micro-dollars (1 000 000 = $1), `…Cents` = cents. Times: unix ms.

### Implementing a resource

```ts
import { APIResource } from "../resource.js";
import { path, type RequestOptions } from "../http.js";
import { idOf, type MachineRef } from "../types/common.js";

export class Vault extends APIResource {
  list(machine: MachineRef, options?: RequestOptions): Promise<VaultCredential[]> {
    return this._http.get<VaultCredential[]>(path`/api/machines/${idOf(machine)}/vault`, undefined, options);
  }
}
```

`this._http` is the shared `HttpClient`; `this._client` is the `Burrowbox` instance (for
`apiKey`, `baseUrl` and other resources). Full HTTP API:

```ts
class HttpClient {
  readonly baseUrl: string; readonly apiKey: string | undefined;
  url(path: string, query?: Query | URLSearchParams): string;               // absolute URL
  request<T>(req: HttpRequest): Promise<T>;
  get<T>(path: string, query?: Query, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions & { query?: Query; idempotent?: boolean }): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions & { query?: Query }): Promise<T>;
}
interface HttpRequest extends RequestOptions {
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;                       // "/api/…" or an absolute https:// URL
  query?: Query | URLSearchParams;    // undefined/null values skipped, booleans → "1"/"0", arrays repeat the key
  body?: unknown;                     // JSON-encoded unless string/bytes/Blob/FormData/URLSearchParams
  auth?: boolean;                     // default true: send Authorization: Bearer <apiKey>
  idempotent?: boolean;               // override retry eligibility
  responseType?: "json" | "text" | "bytes" | "response"; // default "json"; "bytes" → Uint8Array; "response" → raw Response
  throwOnError?: boolean;             // with responseType "response": false returns non-2xx Responses instead of throwing (default true)
}
type Query = Record<string, string | number | boolean | null | undefined | Array<…>>;
```

### File ownership

| Area | Resource file | Types file | Tests |
|---|---|---|---|
| core (done) | `src/client.ts`, `src/http.ts`, `src/errors.ts`, `src/resource.ts`, `src/index.ts` | `src/types/common.ts` | `tests/http.test.ts`, `tests/errors.test.ts`, `tests/helpers.ts` |
| machines + mcp (done) | `src/resources/machines.ts`, `src/resources/mcp.ts` | `src/types/machines.ts`, `src/types/mcp.ts` | `tests/machines.test.ts` |
| live view | `src/resources/live-view.ts` | `src/types/live-view.ts` | `tests/live-view.test.ts` |
| vault | `src/resources/vault.ts` | `src/types/vault.ts` | `tests/vault.test.ts` |
| pools | `src/resources/pools.ts` | `src/types/pools.ts` | `tests/pools.test.ts` |
| automations | `src/resources/automations.ts` | `src/types/automations.ts` | `tests/automations.test.ts` |
| events | `src/resources/events.ts`, `src/webhook-signature.ts` | `src/types/events.ts` | `tests/events.test.ts`, `tests/webhook-signature.test.ts` |
| billing + account | `src/resources/billing.ts`, `src/resources/account.ts` | `src/types/billing.ts`, `src/types/account.ts` | `tests/billing.test.ts`, `tests/account.test.ts` |
| vpn | `src/resources/vpn.ts` | `src/types/vpn.ts` | `tests/vpn.test.ts` |

Everything is already wired into `Burrowbox` and exported from `src/index.ts`. Area owners edit only
their own files. If a new exported name is needed, add it to the area's file and note it for the core
owner to export (types files are re-exported with `export type *`, so new **types** need no index change).
Tests use `tests/helpers.ts`: `client([json(body, status), …])` returns `{ bb, calls }` with a mocked
fetch (no network); `calls[i]` has `url`, `method`, `headers`, parsed `body`.

---

## Client

```ts
import { Burrowbox } from "burrowbox";

class Burrowbox {
  constructor(options?: BurrowboxOptions);
  static readonly DEFAULT_BASE_URL: "https://burrowbox.dev";
  readonly http: HttpClient;
  readonly apiKey: string | undefined;   // getter
  readonly baseUrl: string;              // getter, no trailing slash
  request<T = unknown>(req: HttpRequest): Promise<T>;   // escape hatch for unwrapped endpoints

  readonly machines: Machines;
  readonly mcp: Mcp;
  readonly liveView: LiveView;
  readonly vault: Vault;
  readonly pools: Pools;
  readonly automations: Automations;     // .schedules, .webhooks, .runs()
  readonly events: Events;               // .endpoints, .deliveries()
  readonly billing: Billing;             // .card
  readonly account: Account;             // .apiKeys
  readonly vpn: Vpn;
}

interface BurrowboxOptions {
  apiKey?: string;        // default process.env.BURROWBOX_KEY (guarded: no-op where `process` doesn't exist)
  baseUrl?: string;       // default process.env.BURROWBOX_BASE_URL ?? "https://burrowbox.dev"
  fetch?: FetchLike;      // default globalThis.fetch; (input: string, init?: RequestInit) => Promise<Response>
  timeoutMs?: number;     // default 60_000
  maxRetries?: number;    // default 2
  defaultHeaders?: Record<string, string>;
}
```

### Authentication

`Authorization: Bearer <token>` on every request (except `auth: false` calls).

| Token | Prefix | Works on |
|---|---|---|
| API key | `tmk_` | Everything the account can do |
| Machine token | `tmm_` | Only `POST /api/machines/{id}/mcp` and `POST /api/machines/{id}/live-view` for its own machine |

A client built with a `tmm_` token can call `mcp.machine(id)` and `liveView.create(id, …)` for that
machine. Every other call returns 401 → `AuthenticationError`. No key at all is allowed: public
endpoints (`vpn.locations()`, `billing.pricing()`) work, others get 401.

---

## Errors (`src/errors.ts`)

The API returns `{ "error": "<message>" }` with an HTTP status. There is no error code in the body, so
`code` is derived from the status.

```ts
class BurrowboxError extends Error {
  readonly status: number | undefined;   // undefined for network/timeout/signature errors
  readonly code: BurrowboxErrorCode;
  readonly body: unknown;                // usually { error: string }
  readonly headers: Headers | undefined;
  readonly method: string | undefined;
  readonly url: string | undefined;
}
```

| Class | Status | `code` | Typical cause |
|---|---|---|---|
| `BadRequestError` | 400 | `bad_request` | Invalid field (bad size, cron, label key, region…) |
| `AuthenticationError` | 401 | `authentication_error` | Missing/invalid key; `tmm_` token on a non-MCP route |
| `InsufficientCreditError` | 402 | `insufficient_credit` | Empty balance or no card on file |
| `PermissionError` | 403 | `permission_denied` | Admin-only route, bad origin |
| `NotFoundError` | 404 | `not_found` | Machine/pool/schedule/webhook/endpoint not found or not yours |
| `ConflictError` | 409 | `conflict` | Machine not running (vault, screenshot, apps, windows), busy starting/stopping |
| `PayloadTooLargeError` | 413 | `payload_too_large` | Body over 1 MB |
| `RateLimitError` | 429 | `rate_limited` | Sign-in limits; also limits: 25 machines, 20 schedules/webhooks per machine, 10 event endpoints. Has `retryAfterSeconds?: number` |
| `ServerError` | 5xx | `server_error` | 500 internal, 502 machine unreachable, 503 resize/payments unavailable |
| `ConnectionError` | — | `connection_error` | No HTTP response |
| `TimeoutError` (extends `ConnectionError`) | — | `timeout` | Exceeded `timeoutMs` |
| `WebhookSignatureError` | — | `invalid_signature` | `constructWebhookEvent()` rejected a payload |
| `BurrowboxError` | other | `api_error` | Anything else |

Also exported: `errorFromResponse(status, body, extra?)`, `errorMessage(body, status)`.
A caller's `AbortSignal` rejects with the signal's reason (not wrapped).

---

## Machines: `client.machines` (implemented)

```ts
create(params?: MachineCreateParams, options?): Promise<MachineWithToken>             // POST   /api/machines → 201 (timeout ≥ 180 s)
list(params?: MachineListParams, options?): Promise<Machine[]>                        // GET    /api/machines?externalId=&label.<k>=<v>&includePooled=1
get(machine: MachineRef, options?): Promise<MachineWithToken>                         // GET    /api/machines/{id}
update(machine, params: MachineUpdateParams, options?): Promise<Machine>              // PATCH  /api/machines/{id}
schedule(machine, ttlMinutes: number | null, onExpire?: OnExpire, options?): Promise<Machine> // PATCH /api/machines/{id} {ttlMinutes, onExpire?}
start(machine, params?: { ttlMinutes?: number }, options?): Promise<Machine>          // POST   /api/machines/{id}/start
stop(machine, options?): Promise<Machine>                                             // POST   /api/machines/{id}/stop
destroy(machine, options?): Promise<{ id: string; destroyed: true }>                  // DELETE /api/machines/{id} (never retried)
delete(machine, options?)                                                             // alias of destroy
resize(machine, size: MachineSize, options?): Promise<Machine>                        // POST   /api/machines/{id}/resize {size}
setBrowser(machine, browser: BrowserMode, options?): Promise<MachineAppliedResponse>  // PUT    /api/machines/{id}/browser {browser}
getBrowser(machine, options?): Promise<MachineBrowserInfo>                            // GET    /api/machines/{id}/browser
updateAgent(machine, params?: { restart?: boolean }, options?): Promise<MachineAgentUpdateResponse> // POST /api/machines/{id}/update
events(machine, options?): Promise<MachineEvent[]>                                    // GET    /api/machines/{id}/events  (newest first, ≤ 100)
screenshot(machine, params?: { quality?: number }, options?): Promise<Uint8Array>     // GET    /api/machines/{id}/screenshot.jpg?q=
browserScreenshot(machine, options?): Promise<Uint8Array>                             // GET    /api/machines/{id}/browser/screenshot.png
apps(machine, options?): Promise<DesktopApp[]>                                        // GET    /api/machines/{id}/apps
launchApp(machine, params: { app?: string; command?: string; cwd?: string }, options?): Promise<LaunchAppResult> // POST /api/machines/{id}/apps/launch
windows(machine, options?): Promise<DesktopWindow[]>                                  // GET    /api/machines/{id}/windows
waitForStatus(machine, status?: MachineStatus | MachineStatus[] /* "running" */, opts?: { timeoutMs?; intervalMs?; signal? }): Promise<MachineWithToken> // polls get()
mcp(machine: string | { id: string; mcpToken?: string }, opts?: MachineMcpOptions, options?): Promise<McpServerConfig> // = client.mcp.machine()
liveView(machine, params?: LiveViewCreateParams, options?): Promise<LiveViewLink>     // = client.liveView.create()
```

Key types (`src/types/machines.ts`):

```ts
type MachineStatus = "creating" | "starting" | "running" | "stopping" | "stopped" | "error";
interface Machine {
  id: string; ownerId: string | null; name: string; status: MachineStatus; size: MachineSize; screen: string;
  expiresAt: number | null; expiresInSeconds: number | null; onExpire: "stop" | "destroy";
  lastStopMode: "snapshot" | "crashed" | string | null; lastError: string | null;
  vpn: VpnSetting | null; browser: "light" | "full"; agentVersion: string | null; updateAvailable: boolean; autoUpdate: boolean;
  externalId: string | null; labels: Record<string, string>; poolId: string | null; pooled: boolean;
  mcpUrl: string; createdAt: number; updatedAt: number;
}
interface MachineWithToken extends Machine { mcpToken: string }   // create, get, pools.claim
interface MachineCreateParams { name?; size?; screen?; ttlMinutes?; onExpire?; externalId?; labels?; browser?; vpn?: { type?; country: string; city? } }
interface MachineListParams { externalId?: string; labels?: Labels; includePooled?: boolean }
interface MachineUpdateParams { name?; ttlMinutes?: number | null; onExpire?; externalId?: string | null; labels?: Labels | null; autoUpdate?: boolean; browser?; size? }
interface MachineAppliedResponse extends Machine { applied: boolean; note?: string }
interface MachineAgentUpdateResponse extends Machine { update: { mode: "current" | "live" | "installed" | "restarted" | "pending"; from: string | null; to: string } }
interface MachineBrowserInfo { browser: BrowserMode; capabilities: { engine?; userAgent?; webgl?; webgl2?; renderer? } | null }
interface MachineEvent { at: number; type: string; detail?: unknown }
```

Shared types (`src/types/common.ts`): `MachineRef`, `idOf`, `Timestamp`, `MachineSize`
(`tiny|small|medium|large`), `BrowserMode`, `OnExpire`, `Labels`, `VpnType`, `VpnSetting`, `VpnInput`,
`Action` (`ShellAction | ToolAction | HttpAction`), `DeletedResponse` (`{ id; deleted: true }`).

---

## MCP: `client.mcp` (implemented)

Burrowbox speaks MCP over Streamable HTTP. A config is plain data you can hand to any client.

```ts
platform(opts?: { name?: string /* "burrowbox" */ }): McpServerConfig                       // sync; {baseUrl}/mcp with the API key; throws AuthenticationError without a key
machine(machine: string | { id: string; mcpToken?: string }, opts?: MachineMcpOptions, options?): Promise<McpServerConfig>
  // {baseUrl}/api/machines/{id}/mcp with the machine's tmm_ token:
  //   token from the object if present → else the client's own key if it is a tmm_ token → else GET /api/machines/{id}
  // opts.useApiKey: true → use the client's API key, no request

interface MachineMcpOptions { name?: string /* "burrowbox-<id>" */; useApiKey?: boolean }
interface McpServerConfig {
  name: string;                         // sanitized to [a-zA-Z0-9_-]
  url: string;
  token: string;
  headers: { Authorization: string };   // "Bearer <token>"
  transport: "http";
}
```

Converters (pure functions, exported from the package root):

```ts
toAgentSdkMcpServer(cfg): { type: "http"; url: string; headers: Record<string, string> }       // Claude Agent SDK mcpServers entry
toAgentSdkMcpServers(...cfgs): Record<string, AgentSdkMcpServer>                            // keyed by cfg.name
toMessagesApiMcpServer(cfg): { type: "url"; url: string; name: string; authorization_token: string } // Messages API mcp_servers entry
toClaudeCodeCommand(cfg): string                                                             // `claude mcp add --transport http …`
```

```ts
// Claude Agent SDK
const cfg = await bb.machines.mcp(machine);
for await (const m of query({ prompt, options: { mcpServers: toAgentSdkMcpServers(cfg) } })) { … }
// Messages API MCP connector (beta; use the current MCP connector beta header from Anthropic's docs)
await anthropic.beta.messages.create({ …, mcp_servers: [toMessagesApiMcpServer(cfg)], betas: [/* MCP connector beta */] });
```

---

## Live view: `client.liveView` (stub: `src/resources/live-view.ts`)

```ts
create(machine: MachineRef, params?: LiveViewCreateParams, options?): Promise<LiveViewLink>  // POST /api/machines/{id}/live-view → 201
parseLiveViewMessage(event: { origin: string; data: unknown }, origin = "https://burrowbox.dev"): LiveViewMessage | null // pure, exported from root
```

Works with an API key or the machine's `tmm_` token. Types (`src/types/live-view.ts`):

```ts
type LiveViewMode = "desktop" | "app" | "browser";
interface LiveViewCreateParams {
  mode?: LiveViewMode; interactive?: boolean; app?: string; ttlSeconds?: number /* 60–86400, default 3600 */;
  allowedOrigins?: string[]; showControls?: boolean;
  region?: { x: number; y: number; width: number; height: number }; selector?: string;
}
interface LiveViewLink { url: string; expiresAt: number; mode: LiveViewMode; interactive: boolean; iframe: string }
type LiveViewMessage =
  | { source: "burrowbox"; type: "connected"; mode: LiveViewMode }
  | { source: "burrowbox"; type: "disconnected" }
  | { source: "burrowbox"; type: "url"; url: string; title: string }
  | { source: "burrowbox"; type: "expired" };
```

`parseLiveViewMessage` returns `null` unless `event.origin === origin`, `data` is an object with
`source === "burrowbox"` and a known `type`. The raw WebSocket streams (`/vnc`, `/events`,
`/browser`) are not wrapped: they need a dashboard session or an embed link.

---

## Vault: `client.vault` (stub: `src/resources/vault.ts`)

The machine must be running (409 `ConflictError` otherwise).

```ts
list(machine: MachineRef, options?): Promise<VaultCredential[]>                                  // GET    /api/machines/{id}/vault
set(machine: MachineRef, name: string, params: VaultSetParams, options?): Promise<VaultCredential> // PUT /api/machines/{id}/vault/{name}
delete(machine: MachineRef, name: string, options?): Promise<{ deleted: boolean }>               // DELETE /api/machines/{id}/vault/{name}

interface VaultSetParams { url?: string; username?: string; password?: string; totpSecret?: string; notes?: string }
interface VaultCredential { name: string; url?: string; username?: string; notes?: string; hasPassword: boolean; hasTotp: boolean; updatedAt: string /* ISO */ }
```

`set` merges with the existing credential (omitted fields are kept). Never log or return secrets.

---

## Warm pools: `client.pools` (stub: `src/resources/pools.ts`)

```ts
type PoolRef = string | { id: string };
list(options?): Promise<Pool[]>                                                 // GET    /api/pools
get(pool: PoolRef, options?): Promise<Pool>                                     // GET    /api/pools/{id}
create(params?: PoolCreateParams, options?): Promise<Pool>                      // POST   /api/pools → 201
update(pool: PoolRef, params?: PoolUpdateParams, options?): Promise<Pool>       // PATCH  /api/pools/{id}
resume(pool: PoolRef, options?): Promise<Pool>                                  // PATCH  /api/pools/{id} with {}
delete(pool: PoolRef, options?): Promise<{ id: string; deleted: true; destroyedMachines: number }> // DELETE /api/pools/{id}
claim(pool: PoolRef, params?: PoolClaimParams, options?): Promise<PoolClaimResponse> // POST /api/pools/{id}/claim → 200|201 (timeout ≥ 180 s)
```

```ts
interface Pool {
  id: string; name: string; size: MachineSize; screen: string; browser: BrowserMode;
  target: number; ready: number; warming: number; setup: Action[]; paused: boolean; setupFailures: number;
  lastSetup: { at: number; ok: boolean; machineId: string; durationMs: number; output: string } | null; createdAt: number;
}
interface PoolCreateParams { name?; size?; screen?; target?: number /* 0–10, default 1 */; browser?; setup?: Action[] /* ≤ 10 */ }
interface PoolUpdateParams { name?; target?; size?; screen?; browser?; setup?: Action[] | null }
interface PoolClaimParams { name?; externalId?; labels?; ttlMinutes?; onExpire?; vpn?: { type?; country: string; city? } }
interface PoolClaimResponse extends MachineWithToken { fromPool: boolean; setup?: "pending" | "running" | "done" | "failed" | string }
```

---

## Automations: `client.automations` (stub: `src/resources/automations.ts`)

Scheduled jobs and inbound webhooks that run an `Action` inside a machine.

```ts
// client.automations.schedules
list(machine: MachineRef, options?): Promise<Schedule[]>                                                   // GET    /api/machines/{id}/schedules
create(machine, params: ScheduleCreateParams, options?): Promise<ScheduleWithUpcoming>                     // POST   /api/machines/{id}/schedules → 201
update(machine, scheduleId: string, params: ScheduleUpdateParams, options?): Promise<ScheduleWithUpcoming>  // PATCH  /api/machines/{id}/schedules/{scheduleId}
delete(machine, scheduleId: string, options?): Promise<{ id: string; deleted: true }>                      // DELETE /api/machines/{id}/schedules/{scheduleId}
run(machine, scheduleId: string, options?): Promise<RunResult>                                             // POST   /api/machines/{id}/schedules/{scheduleId}/run (waits; timeout ≥ 20 min)

// client.automations.webhooks
list(machine, options?): Promise<Webhook[]>                                                                // GET    /api/machines/{id}/webhooks
create(machine, params: WebhookCreateParams, options?): Promise<Webhook>                                   // POST   /api/machines/{id}/webhooks → 201 (url shown once)
update(machine, webhookId: string, params: WebhookUpdateParams, options?): Promise<Webhook>                // PATCH  /api/machines/{id}/webhooks/{webhookId}
rotate(machine, webhookId: string, options?): Promise<Webhook>                                             // POST   /api/machines/{id}/webhooks/{webhookId}/rotate (new url)
delete(machine, webhookId: string, options?): Promise<{ id: string; deleted: true }>                       // DELETE /api/machines/{id}/webhooks/{webhookId}
call(url: string, params?: WebhookCallParams, options?): Promise<Response>                                 // {method} <url>?<query> via http.request({ auth: false, idempotent: false,
                                                                                                           //   responseType: "response", throwOnError: false }): non-2xx is returned, NOT thrown
// client.automations
runs(machine, params?: { limit?: number /* default 50, max 200 */ }, options?): Promise<JobRun[]>         // GET    /api/machines/{id}/runs?limit=
```

```ts
interface Schedule { id; machineId; name; cron; timezone: "UTC"; action: Action; wakeIfStopped: boolean; stopAfter: boolean; enabled: boolean;
                     nextRunAt: number | null; lastRunAt: number | null; lastStatus: RunStatus | null; createdAt: number }
interface ScheduleWithUpcoming extends Schedule { upcoming: number[] }
interface ScheduleCreateParams { name?; cron: string; action: Action; wakeIfStopped?; stopAfter?; enabled? }
type ScheduleUpdateParams = Partial<ScheduleCreateParams>;
interface Webhook { id; machineId; name; action: Action; mode: "sync" | "async"; wakeIfStopped; stopAfter; enabled; lastCalledAt: number | null; createdAt: number; url: string }
interface WebhookCreateParams { name?; action: Action; mode?: "sync" | "async"; wakeIfStopped?; stopAfter? }
interface WebhookUpdateParams { name?; action?; mode?; wakeIfStopped?; stopAfter?; enabled? }
interface WebhookCallParams { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" /* POST */; body?: unknown; headers?; query?: Record<string, string> }
type RunStatus = "running" | "ok" | "error" | "skipped";
interface RunResult { runId: string; status: "ok" | "error" | "skipped"; output: string; http?: { status: number; contentType: string; body: string } }
interface JobRun { id; source: "schedule" | "webhook" | "manual"; sourceId; status: RunStatus; output: string | null; startedAt; finishedAt: number | null; durationMs: number | null }
```

`Webhook.url` outside create/rotate is the placeholder string `"(shown once, when created or rotated)"`.

---

## Event webhooks: `client.events` (stub: `src/resources/events.ts`, `src/webhook-signature.ts`)

```ts
// client.events.endpoints
list(options?): Promise<EventEndpoint[]>                                                     // GET    /api/event-webhooks
create(params: EventEndpointCreateParams, options?): Promise<EventEndpointWithSecret>        // POST   /api/event-webhooks → 201 (secret once)
update(endpointId: string, params: EventEndpointUpdateParams, options?): Promise<EventEndpoint> // PATCH /api/event-webhooks/{id}
rotateSecret(endpointId: string, options?): Promise<EventEndpointWithSecret>                 // POST   /api/event-webhooks/{id}/rotate-secret
test(endpointId: string, options?): Promise<{ ok: boolean; status?: number; error?: string }> // POST  /api/event-webhooks/{id}/test
delete(endpointId: string, options?): Promise<{ id: string; deleted: true }>                 // DELETE /api/event-webhooks/{id}
// client.events
deliveries(params?: { endpoint?: string; limit?: number }, options?): Promise<EventDelivery[]> // GET /api/event-webhooks/deliveries?endpoint=&limit=
```

Signature helpers (pure functions, exported from the root; Web Crypto `crypto.subtle`, no Node APIs):

```ts
verifyWebhookSignature(rawBody: string | Uint8Array | ArrayBuffer, signatureHeader: string | null | undefined, secret: string,
                       options?: { toleranceSeconds?: number /* 300 */; now?: number /* unix s */ }): Promise<boolean>   // never throws on bad input
constructWebhookEvent(rawBody, signatureHeader, secret, options?): Promise<BurrowboxEvent>   // throws WebhookSignatureError; then JSON.parse
signWebhookPayload(rawBody, secret, timestamp?: number /* unix s, default now */): Promise<string> // "t=<ts>,v1=<hex>"
```

Signing scheme (from the server, `events.ts`): header `Burrowbox-Signature: t=<unix seconds>,v1=<hex>`
where `hex = HMAC-SHA256(key = secret string (the full "whsec_…" value, UTF-8), message = "<t>.<raw body>")`.
Compare in constant time; reject when `|now − t| > toleranceSeconds`. Other headers:
`Burrowbox-Event: <type>`, `Burrowbox-Delivery: dlv_…`.

```ts
type EventType = "machine.created" | "machine.started" | "machine.stopped" | "machine.error" | "machine.expired"
               | "machine.destroyed" | "machine.claimed" | "run.succeeded" | "run.failed";
type EventSubscription = EventType | "*";
interface EventEndpoint { id: string; url: string; description: string | null; events: EventSubscription[]; enabled: boolean; createdAt: number }
interface EventEndpointWithSecret extends EventEndpoint { secret: string }
interface EventEndpointCreateParams { url: string; events?: EventSubscription[]; description?: string }
interface EventEndpointUpdateParams { url?; events?; description?; enabled?: boolean }
interface EventDelivery { id; endpointId; eventId; type: EventType | "test"; status: "pending" | "delivered" | "failed"; attempts: number;
                          responseStatus: number | null; lastError: string | null; createdAt: number; deliveredAt: number | null }
type BurrowboxEvent =   // { id: "evt_…", type, createdAt: ISO string, data }
  | { …; type: "machine.*"; data: { machine: { id; name; status; size; externalId; labels }; detail: Record<string, unknown> | string | null } }
  | { …; type: "run.succeeded" | "run.failed"; data: { run: { id; source; sourceId; status; output }; machine: { id; name; externalId; labels } } }
  | { …; type: "test"; data: { message: string } };
```

---

## Billing: `client.billing` (stub: `src/resources/billing.ts`)

```ts
get(options?): Promise<BillingSummary>                                       // GET    /api/billing
ledger(params?: { limit?: number /* 1–500 */; offset?: number; kind?: "usage" | "credit" }, options?): Promise<LedgerEntry[]> // GET /api/billing/ledger
setAutoRefill(params: { thresholdCents?: number; amountCents?: number }, options?): Promise<CardInfo> // PUT /api/billing/auto-refill
topUp(params: { cents: number }, options?): Promise<CheckoutSession>         // POST   /api/billing/topup → { url, mode }
usage(params?: { groupBy?: "externalId" | "machine"; from?: number; to?: number }, options?): Promise<UsageReport> // GET /api/usage
pricing(options?): Promise<PublicPricing>                                    // GET    /api/pricing (auth: false)
// client.billing.card
get(options?): Promise<CardInfo>                                             // GET    /api/billing/card
checkout(options?): Promise<CheckoutSession>                                 // POST   /api/billing/card → { url }
remove(options?): Promise<{ removed: boolean }>                              // DELETE /api/billing/card
```

```ts
interface BillingSummary { balanceMicros; burnMicrosPerHour; runwayHours: number | null; usedThisMonthMicros; addedThisMonthMicros;
                           machines: { running: number; stopped: number }; pricing: Pricing }
interface LedgerEntry { id: number | string; at: number; kind: string; amountMicros: number; ref: string | null; description: string | null }
interface CardInfo { card: { brand; last4; expMonth; expYear } | null; required: boolean;
                     autoRefill: { thresholdCents; amountCents; paused: boolean; error: string | null; thresholdOptions: number[]; amountOptions: number[] } }
interface CheckoutSession { url: string; mode?: "stripe" | "dev" }
interface UsageReport { from: number; to: number; groupBy: "externalId" | "machine"; totalMicros: number;
                        groups: { externalId?: string | null; machineId?: string | null; usageMicros: number; machines: number }[] }
interface Pricing { currency: "usd"; runningCentsPerHour: Record<string, number>; stoppedCentsPerHour; signupCreditCents; topUpOptionsCents: number[];
                    minTopUpCents; maxTopUpCents; provider: "stripe" | "dev" | "none"; vpn: Record<VpnType, {centsPerHour; centsPerGb; centsPer1kConnections}> | null }
interface PublicPricing extends Pricing { sizes: Record<string, { instance; cpus; memoryMb; diskGb }>; signup: boolean }
```

## Account: `client.account` (stub: `src/resources/account.ts`)

```ts
get(options?): Promise<AccountInfo>                                          // GET    /api/me
update(params: { name?: string }, options?): Promise<AccountInfo>            // PATCH  /api/me
// client.account.apiKeys
list(options?): Promise<ApiKey[]>                                            // GET    /api/keys
create(params?: { name?: string }, options?): Promise<{ id: string; secret: string }> // POST /api/keys → 201 (secret once)
delete(keyId: string, options?): Promise<{ deleted: boolean }>               // DELETE /api/keys/{id}

interface AccountInfo { id; email; name; role: "user" | "admin"; emailVerified: boolean; createdAt: number; billing: BillingSummary | null;
                        payment: { required: boolean; card: Card | null; autoRefillPaused: boolean } }  // type is `Account` in src/types/account.ts, exported as AccountInfo
interface ApiKey { id: string; name: string; prefix: string; createdAt: number; lastUsedAt: number | null }
```

Sign-up, login, password reset and email verification are dashboard-only (session cookies, same-origin)
and are not part of the SDK.

---

## VPN: `client.vpn` (stub: `src/resources/vpn.ts`)

```ts
locations(options?): Promise<VpnLocations>                                   // GET /api/vpn/locations (auth: false)
get(machine: MachineRef, options?): Promise<MachineVpnStatus>                // GET /api/machines/{id}/vpn
set(machine: MachineRef, vpn: VpnInput | null, options?): Promise<MachineVpnResponse> // PUT /api/machines/{id}/vpn  body { vpn }
disable(machine: MachineRef, options?): Promise<MachineVpnResponse>          // PUT /api/machines/{id}/vpn  body { vpn: null }

interface VpnInput { type?: "proxy" | "unlock"; country?: string; city?: string | null }   // partial: omitted fields keep their value
interface VpnLocations { available: boolean; types: { type; name; description; available; cityTargeting: boolean; pricing }[];
                         locations: { country: string; name: string }[]; countries?: { code; name }[]; note: string }
interface MachineVpnStatus { vpn: VpnSetting | null; egress: { ok: boolean; ip?; country?; region?; city?; org?; error? } | null }
type MachineVpnResponse = Machine & { applied: boolean; note?: string };
```

A VPN can also be set at creation (`machines.create({ vpn })`) and on claim (`pools.claim(id, { vpn })`).

---

## Not wrapped

- Live-view WebSocket streams (`/api/machines/{id}/vnc|events|browser`): need a dashboard session or an embed link token.
- Dashboard auth endpoints (`/api/auth/*`, `/api/me/password`, `/api/me/verify-email`), Stripe callbacks
  (`/api/billing/confirm`, `/api/billing/card/confirm`, `/api/billing/webhook`), admin routes.
- `/api/info`, `/api/health` (use `client.request()`).

---

## Doc/server differences

The SDK follows the server. Worth fixing in the docs:

1. **Machine token on other routes → 401, not 403.** `docs/errors.md` says a machine token on a
   non-MCP route gives 403; the server doesn't recognise `tmm_` tokens outside MCP/live-view and returns
   401 `unauthorized`.
2. **Live-view link returns 201**, not 200 (docs don't state it).
3. **Machine object has extra fields** not in `docs/machines.md`: `ownerId`, `updatedAt`.
4. **Pool object has `browser`**, and `PATCH /api/pools/{id}` accepts `browser` (docs list only name/target/size/screen/setup).
   `DELETE /api/pools/{id}` returns `{ id, deleted, destroyedMachines }`.
5. **Vault, screenshot, apps, windows need a running machine** (409 otherwise): vault requests are
   proxied to the machine. `docs/vault.md` doesn't say so.
6. **Undocumented endpoints**: `POST /api/machines/{id}/apps/launch`, `GET /api/machines/{id}/browser/screenshot.png`,
   `GET/POST/DELETE /api/keys`, `GET/PATCH /api/me`, `GET /api/pricing` (public).
7. **More 429s** than the docs say: 20 schedules / 20 webhooks per machine, 10 event endpoints, 25 machines per account (`MAX_MACHINES_PER_USER`).
8. **`/api/usage?groupBy=machine`** returns groups keyed `machineId` (docs only show `externalId`).
9. **Auto-refill limits**: server accepts threshold $1–$1,000 and amount $10–$1,000 (`docs/billing.md` says "any value via the API").
10. **Other statuses**: 413 (body over 1 MB), 503 (resize failed, payments/embedding not configured), 502 (agent update failed).
11. **`PATCH /api/machines/{id}`** also accepts `size` and `browser` (documented in passing) and `autoUpdate`.
12. **`POST /api/machines/{id}/update`** takes `{ restart?: boolean }` and returns the machine plus `update: { mode, from, to }`.
13. **`GET /api/vpn/locations`** also returns `countries` (`{code, name}`) and `types[].cityTargeting`.
14. **Bearer via query string**: the server also reads `?token=` when there's no `Authorization` header (the SDK always uses the header).
