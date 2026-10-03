import { BurrowboxError, ConnectionError, TimeoutError, errorFromResponse } from "./errors.js";
import { VERSION } from "./version.js";

/** A `fetch`-compatible function (global fetch, undici, node-fetch, a test mock…). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Per-call overrides accepted as the last argument of every resource method. */
export interface RequestOptions {
  /** Abort the request after this many milliseconds. Defaults to the client's `timeoutMs`. */
  timeoutMs?: number;
  /** Retries for idempotent requests (GET, HEAD, PUT, DELETE). Defaults to the client's `maxRetries`. */
  maxRetries?: number;
  /** Cancel the request. */
  signal?: AbortSignal;
  /** Extra headers sent with this request. */
  headers?: Record<string, string>;
}

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | QueryValue[]>;

export type ResponseType = "json" | "text" | "bytes" | "response";

export interface HttpRequest extends RequestOptions {
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** API path such as `/api/machines`, or an absolute `https://…` URL. */
  path: string;
  query?: Query | URLSearchParams | undefined;
  /** JSON-encoded unless it's a string, ArrayBuffer, Uint8Array, Blob, FormData or URLSearchParams. */
  body?: unknown;
  /** Send `Authorization: Bearer <apiKey>`. Default `true`. */
  auth?: boolean;
  /**
   * Whether the request may be retried after a 429/5xx/network error. Defaults to `true` for
   * GET/HEAD/PUT/DELETE and `false` for POST/PATCH.
   */
  idempotent?: boolean;
  /** How to read a successful response. Default `"json"` (an empty body yields `undefined`). */
  responseType?: ResponseType;
  /**
   * With `responseType: "response"`, `false` returns non-2xx responses instead of throwing (no
   * retries either). Default `true`.
   */
  throwOnError?: boolean;
}

export interface HttpClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  fetch: FetchLike;
  timeoutMs: number;
  maxRetries: number;
  defaultHeaders?: Record<string, string> | undefined;
}

const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE"]);

/** Statuses worth retrying. 429 is retried too, but only for idempotent requests (like every retry). */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504 || status === 500;
}

/** Exponential backoff with jitter: ~0.5 s, 1 s, 2 s… capped at 8 s. */
export function backoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds)) {
    return Math.min(60_000, Math.max(0, retryAfterSeconds * 1000));
  }
  const base = Math.min(8_000, 500 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2);
}

/**
 * Tagged template that URL-encodes every interpolated value:
 * `path\`/api/machines/${id}/vault/${name}\``.
 */
export function path(strings: TemplateStringsArray, ...values: Array<string | number>): string {
  let out = strings[0] ?? "";
  values.forEach((v, i) => {
    out += encodeURIComponent(String(v)) + (strings[i + 1] ?? "");
  });
  return out;
}

function appendQuery(url: URL, query: Query | URLSearchParams | undefined) {
  if (!query) return;
  if (query instanceof URLSearchParams) {
    for (const [k, v] of query) url.searchParams.append(k, v);
    return;
  }
  for (const [k, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (v === undefined || v === null) continue;
      url.searchParams.append(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
  }
}

function isRawBody(b: unknown): b is BodyInit {
  return (
    typeof b === "string" ||
    b instanceof ArrayBuffer ||
    b instanceof Uint8Array ||
    (typeof Blob !== "undefined" && b instanceof Blob) ||
    (typeof FormData !== "undefined" && b instanceof FormData) ||
    b instanceof URLSearchParams
  );
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return undefined;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json") || /^[\s]*[{[]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * The shared HTTP layer: JSON in/out, auth header, query strings, timeouts, and retries with
 * backoff on 408/429/5xx and network errors for idempotent requests only.
 */
export class HttpClient {
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch;
    this.timeoutMs = opts.timeoutMs;
    this.maxRetries = opts.maxRetries;
    this.defaultHeaders = opts.defaultHeaders ?? {};
  }

  /** Absolute URL for an API path (query included). */
  url(p: string, query?: Query | URLSearchParams): string {
    const url = new URL(/^https?:\/\//i.test(p) ? p : `${this.baseUrl}${p.startsWith("/") ? "" : "/"}${p}`);
    appendQuery(url, query);
    return url.toString();
  }

  async request<T = unknown>(req: HttpRequest): Promise<T> {
    const method = req.method;
    const url = this.url(req.path, req.query);
    const idempotent = req.idempotent ?? IDEMPOTENT.has(method);
    const maxRetries = idempotent ? Math.max(0, req.maxRetries ?? this.maxRetries) : 0;
    const timeoutMs = req.timeoutMs ?? this.timeoutMs;

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": `burrowbox-js/${VERSION}`,
      ...this.defaultHeaders,
    };
    if (req.auth !== false && this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    let body: BodyInit | undefined;
    if (req.body !== undefined && method !== "GET" && method !== "HEAD") {
      if (isRawBody(req.body)) body = req.body;
      else {
        body = JSON.stringify(req.body);
        headers["content-type"] = "application/json";
      }
    }
    Object.assign(headers, req.headers);

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onAbort = () => controller.abort(req.signal?.reason);
      if (req.signal?.aborted) controller.abort(req.signal.reason);
      else req.signal?.addEventListener("abort", onAbort, { once: true });

      let res: Response;
      try {
        res = await this.fetchImpl(url, { method, headers, body, signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        req.signal?.removeEventListener("abort", onAbort);
        if (req.signal?.aborted) throw req.signal.reason ?? err;
        const e = timedOut
          ? new TimeoutError(`Request timed out after ${timeoutMs} ms: ${method} ${url}`, { method, url, cause: err })
          : new ConnectionError(`Could not reach Burrowbox: ${(err as Error)?.message ?? String(err)}`, { method, url, cause: err });
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt), req.signal);
          continue;
        }
        throw e;
      }

      try {
        if (!res.ok && req.responseType === "response" && req.throwOnError === false) return res as unknown as T;
        if (res.ok) {
          const type = req.responseType ?? "json";
          if (type === "response") return res as unknown as T;
          if (type === "bytes") return new Uint8Array(await res.arrayBuffer()) as unknown as T;
          if (type === "text") return (await res.text()) as unknown as T;
          if (method === "HEAD" || res.status === 204) return undefined as T;
          return (await readBody(res)) as T;
        }
        const errBody = await readBody(res);
        const error = errorFromResponse(res.status, errBody, { headers: res.headers, method, url });
        if (attempt < maxRetries && isRetryableStatus(res.status)) {
          const ra = "retryAfterSeconds" in error ? (error as { retryAfterSeconds?: number }).retryAfterSeconds : undefined;
          await sleep(backoffMs(attempt, ra), req.signal);
          continue;
        }
        throw error;
      } catch (err) {
        if (err instanceof BurrowboxError) throw err;
        if (req.signal?.aborted) throw req.signal.reason ?? err;
        if (timedOut) throw new TimeoutError(`Request timed out after ${timeoutMs} ms: ${method} ${url}`, { method, url, cause: err });
        throw new ConnectionError(`Failed to read the response: ${(err as Error)?.message ?? String(err)}`, { method, url, cause: err });
      } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  get<T = unknown>(p: string, query?: Query, options?: RequestOptions): Promise<T> {
    return this.request<T>({ ...options, method: "GET", path: p, query });
  }
  post<T = unknown>(p: string, body?: unknown, options?: RequestOptions & { query?: Query; idempotent?: boolean }): Promise<T> {
    return this.request<T>({ ...options, method: "POST", path: p, body });
  }
  put<T = unknown>(p: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ ...options, method: "PUT", path: p, body });
  }
  patch<T = unknown>(p: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>({ ...options, method: "PATCH", path: p, body });
  }
  delete<T = unknown>(p: string, options?: RequestOptions & { query?: Query }): Promise<T> {
    return this.request<T>({ ...options, method: "DELETE", path: p });
  }
}
