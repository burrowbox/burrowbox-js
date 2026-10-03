import { Burrowbox, type BurrowboxOptions, type FetchLike } from "../src/index.js";

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = Response | ((call: RecordedCall) => Response | Promise<Response>) | Error;

/** JSON response helper. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/**
 * A fetch mock: responders are used in order (the last one repeats). Every call is recorded with
 * its parsed JSON body.
 */
export function mockFetch(...responders: Responder[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fetch: FetchLike = async (input, init = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    let body: unknown = init.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* keep string */
      }
    }
    const call: RecordedCall = { url: String(input), method: init.method ?? "GET", headers, body };
    calls.push(call);
    const r = responders[Math.min(i++, responders.length - 1)];
    if (r === undefined) throw new Error("mockFetch: no responder");
    if (r instanceof Error) throw r;
    return typeof r === "function" ? r(call) : r.clone();
  };
  return { fetch, calls };
}

/** A client wired to a mock fetch, with no retries delay surprises (maxRetries 0 unless given). */
export function client(responders: Responder[], opts: BurrowboxOptions = {}) {
  const m = mockFetch(...responders);
  const bb = new Burrowbox({ apiKey: "tmk_test", baseUrl: "https://bb.test", maxRetries: 0, ...opts, fetch: m.fetch });
  return { bb, calls: m.calls };
}

export const machineFixture = {
  id: "2f6aeedcd3",
  ownerId: "u_1",
  name: "acme",
  status: "running",
  size: "tiny",
  screen: "1440x900",
  expiresAt: null,
  expiresInSeconds: null,
  onExpire: "stop",
  lastStopMode: null,
  lastError: null,
  vpn: null,
  browser: "light",
  agentVersion: "a-1",
  updateAvailable: false,
  autoUpdate: true,
  externalId: null,
  labels: {},
  poolId: null,
  pooled: false,
  mcpUrl: "https://bb.test/api/machines/2f6aeedcd3/mcp",
  createdAt: 1,
  updatedAt: 1,
  mcpToken: "tmm_abc",
} as const;
