import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Burrowbox,
  ConnectionError,
  HttpClient,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  path,
} from "../src/index.js";
import { backoffMs } from "../src/http.js";
import { client, json, mockFetch } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const http = (responders: Parameters<typeof mockFetch>, opts: Partial<ConstructorParameters<typeof HttpClient>[0]> = {}) => {
  const m = mockFetch(...responders);
  const h = new HttpClient({ baseUrl: "https://bb.test/", apiKey: "tmk_x", fetch: m.fetch, timeoutMs: 1000, maxRetries: 2, ...opts });
  return { h, calls: m.calls };
};

describe("HttpClient", () => {
  it("sends auth, JSON body and parses JSON", async () => {
    const { h, calls } = http([json({ ok: true }, 201)]);
    const r = await h.post("/api/things", { a: 1 });
    expect(r).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("https://bb.test/api/things");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers.authorization).toBe("Bearer tmk_x");
    expect(calls[0]!.headers["content-type"]).toBe("application/json");
    expect(calls[0]!.body).toEqual({ a: 1 });
  });

  it("omits auth when auth: false or no key", async () => {
    const { h, calls } = http([json({})]);
    await h.request({ method: "GET", path: "/api/vpn/locations", auth: false });
    expect(calls[0]!.headers.authorization).toBeUndefined();
    const { h: h2, calls: c2 } = http([json({})], { apiKey: undefined });
    await h2.get("/x");
    expect(c2[0]!.headers.authorization).toBeUndefined();
  });

  it("encodes query params (arrays, booleans, skips undefined/null)", async () => {
    const { h, calls } = http([json([])]);
    await h.get("/api/machines", { a: "x y", b: true, c: undefined, d: null, e: [1, 2], "label.plan": "pro" });
    const u = new URL(calls[0]!.url);
    expect(u.searchParams.get("a")).toBe("x y");
    expect(u.searchParams.get("b")).toBe("1");
    expect(u.searchParams.has("c")).toBe(false);
    expect(u.searchParams.has("d")).toBe(false);
    expect(u.searchParams.getAll("e")).toEqual(["1", "2"]);
    expect(u.searchParams.get("label.plan")).toBe("pro");
  });

  it("accepts absolute URLs", async () => {
    const { h, calls } = http([json({})]);
    await h.request({ method: "POST", path: "https://other.test/hooks/wh_1/s", auth: false, body: "raw" });
    expect(calls[0]!.url).toBe("https://other.test/hooks/wh_1/s");
    expect(calls[0]!.body).toBe("raw");
    expect(calls[0]!.headers["content-type"]).toBeUndefined();
  });

  it("returns undefined for empty bodies and bytes for binary", async () => {
    const { h } = http([new Response(null, { status: 204 }), new Response(new Uint8Array([1, 2, 3]))]);
    expect(await h.delete("/x")).toBeUndefined();
    const bytes = await h.request<Uint8Array>({ method: "GET", path: "/img", responseType: "bytes" });
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("maps errors with status, code, body and message", async () => {
    const { h } = http([json({ error: "machine abc not found" }, 404)]);
    const err: any = await h.get("/api/machines/abc").catch((e: any) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("machine abc not found");
    expect(err.body).toEqual({ error: "machine abc not found" });
    expect(err.method).toBe("GET");
  });

  it("retries idempotent requests on 5xx and 429, then succeeds", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { h, calls } = http([json({ error: "boom" }, 502), json({ error: "slow down" }, 429, { "retry-after": "0" }), json({ ok: 1 })]);
    expect(await h.get("/x")).toEqual({ ok: 1 });
    expect(calls).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it("gives up after maxRetries", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { h, calls } = http([json({ error: "down" }, 503)], { maxRetries: 1 });
    await expect(h.get("/x")).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("does not retry POST/PATCH or 4xx", async () => {
    const { h, calls } = http([json({ error: "down" }, 503)]);
    await expect(h.post("/x", {})).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveLength(1);
    const { h: h2, calls: c2 } = http([json({ error: "nope" }, 404)]);
    await expect(h2.get("/x")).rejects.toBeInstanceOf(NotFoundError);
    expect(c2).toHaveLength(1);
    const { h: h3, calls: c3 } = http([json({ error: "limit" }, 429)]);
    await expect(h3.post("/api/machines", {})).rejects.toBeInstanceOf(RateLimitError);
    expect(c3).toHaveLength(1);
  });

  it("retries POST when marked idempotent", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { h, calls } = http([json({}, 500), json({ ok: 1 })]);
    await h.request({ method: "POST", path: "/x", idempotent: true });
    expect(calls).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it("wraps network errors and retries them for GET", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { h, calls } = http([new TypeError("fetch failed"), json({ ok: 1 })]);
    expect(await h.get("/x")).toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);
    const { h: h2 } = http([new TypeError("fetch failed")], { maxRetries: 0 });
    const err: any = await h2.get("/x").catch((e: any) => e);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.code).toBe("connection_error");
    vi.restoreAllMocks();
  });

  it("times out", async () => {
    const hang = (_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const h = new HttpClient({ baseUrl: "https://bb.test", fetch: hang, timeoutMs: 20, maxRetries: 0 });
    const err: any = await h.get("/x").catch((e: any) => e);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.code).toBe("timeout");
  });

  it("honors a caller's AbortSignal without wrapping it", async () => {
    const hang = (_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const h = new HttpClient({ baseUrl: "https://bb.test", fetch: hang, timeoutMs: 5000, maxRetries: 3 });
    const ac = new AbortController();
    const p = h.get("/x", undefined, { signal: ac.signal });
    ac.abort(new Error("stop"));
    await expect(p).rejects.toThrow("stop");
  });

  it("backoff grows and honors Retry-After", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(10)).toBe(8000);
    expect(backoffMs(0, 3)).toBe(3000);
    vi.restoreAllMocks();
  });

  it("path`` encodes interpolations", () => {
    expect(path`/api/machines/${"a/b"}/vault/${"git hub"}`).toBe("/api/machines/a%2Fb/vault/git%20hub");
  });
});

describe("Burrowbox client", () => {
  it("defaults to burrowbox.dev and reads BURROWBOX_KEY", async () => {
    vi.stubEnv("BURROWBOX_KEY", "tmk_env");
    vi.stubEnv("BURROWBOX_BASE_URL", "");
    const m = mockFetch(json([]));
    const bb = new Burrowbox({ fetch: m.fetch });
    expect(bb.baseUrl).toBe("https://burrowbox.dev");
    expect(bb.apiKey).toBe("tmk_env");
    await bb.machines.list();
    expect(m.calls[0]!.url).toBe("https://burrowbox.dev/api/machines");
    expect(m.calls[0]!.headers.authorization).toBe("Bearer tmk_env");
  });

  it("explicit options win over env", () => {
    vi.stubEnv("BURROWBOX_KEY", "tmk_env");
    const bb = new Burrowbox({ apiKey: "tmm_tok", baseUrl: "http://localhost:8787/", fetch: mockFetch(json({})).fetch });
    expect(bb.apiKey).toBe("tmm_tok");
    expect(bb.baseUrl).toBe("http://localhost:8787");
  });

  it("works without process (non-Node runtimes)", () => {
    const g = globalThis as { process?: unknown };
    const saved = g.process;
    try {
      g.process = undefined;
      const bb = new Burrowbox({ fetch: mockFetch(json({})).fetch });
      expect(bb.apiKey).toBeUndefined();
    } finally {
      g.process = saved;
    }
  });

  it("request() escape hatch", async () => {
    const { bb, calls } = client([json({ ok: true })]);
    expect(await bb.request({ method: "GET", path: "/api/health", auth: false })).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("https://bb.test/api/health");
  });
});

describe("throwOnError", () => {
  it("returns non-2xx Responses when throwOnError is false", async () => {
    const m = mockFetch(json({ error: "unknown webhook" }, 404));
    const h = new HttpClient({ baseUrl: "https://bb.test", fetch: m.fetch, timeoutMs: 1000, maxRetries: 2 });
    const res = await h.request<Response>({ method: "POST", path: "https://bb.test/hooks/wh_1/x", responseType: "response", throwOnError: false, auth: false });
    expect(res.status).toBe(404);
    expect(m.calls).toHaveLength(1);
  });
});
