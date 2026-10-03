import { describe, expect, it } from "vitest";
import { Burrowbox, NotFoundError, RateLimitError, TimeoutError } from "../src/index.js";
import { client, json, machineFixture } from "./helpers.js";

const base = "https://bb.test/api/machines/abc";
const action = { type: "shell", command: "echo hi" } as const;
const schedule = {
  id: "sch_1a2b3c4d5e6f",
  machineId: "abc",
  name: "Nightly",
  cron: "0 3 * * *",
  timezone: "UTC",
  action,
  wakeIfStopped: true,
  stopAfter: false,
  enabled: true,
  nextRunAt: 2,
  lastRunAt: null,
  lastStatus: null,
  createdAt: 1,
};
const webhook = {
  id: "wh_1a2b3c4d5e6f",
  machineId: "abc",
  name: "Webhook",
  action,
  mode: "sync",
  wakeIfStopped: true,
  stopAfter: false,
  enabled: true,
  lastCalledAt: null,
  createdAt: 1,
  url: "(shown once, when created or rotated)",
};

describe("automations.schedules", () => {
  it("list / create / update / delete", async () => {
    const { bb, calls } = client([json([schedule]), json({ ...schedule, upcoming: [2, 3, 4] }, 201), json({ ...schedule, upcoming: [] }), json({ id: schedule.id, deleted: true })]);
    expect(await bb.automations.schedules.list(machineFixture)).toHaveLength(1);
    const created = await bb.automations.schedules.create("abc", { name: "Nightly", cron: "0 3 * * *", action, stopAfter: true });
    expect(created.upcoming).toEqual([2, 3, 4]);
    await bb.automations.schedules.update("abc", schedule.id, { enabled: false });
    expect(await bb.automations.schedules.delete("abc", schedule.id)).toEqual({ id: schedule.id, deleted: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", "https://bb.test/api/machines/2f6aeedcd3/schedules", undefined],
      ["POST", `${base}/schedules`, { name: "Nightly", cron: "0 3 * * *", action, stopAfter: true }],
      ["PATCH", `${base}/schedules/${schedule.id}`, { enabled: false }],
      ["DELETE", `${base}/schedules/${schedule.id}`, undefined],
    ]);
  });

  it("create is not retried on 429 (limit of 20 per machine)", async () => {
    const { bb, calls } = client([json({ error: "at most 20 schedules per machine" }, 429)], { maxRetries: 3 });
    await expect(bb.automations.schedules.create("abc", { cron: "@hourly", action })).rejects.toBeInstanceOf(RateLimitError);
    expect(calls).toHaveLength(1);
  });

  it("run waits with a long default timeout that options can override", async () => {
    const result = { runId: "run_1a2b3c4d5e6f7a8b", status: "error", output: "exit 1" };
    const { bb, calls } = client([json(result)]);
    expect(await bb.automations.schedules.run("abc", schedule.id)).toEqual(result);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${base}/schedules/${schedule.id}/run`);
    expect(calls[0]!.body).toEqual({});
  });

  it("run: options.timeoutMs wins over the 20 min default", async () => {
    const fetch = (_: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const bb = new Burrowbox({ apiKey: "tmk_test", baseUrl: "https://bb.test", maxRetries: 0, fetch });
    await expect(bb.automations.schedules.run("abc", schedule.id, { timeoutMs: 10 })).rejects.toThrow(TimeoutError);
  });

  it("encodes ids and maps 404", async () => {
    const { bb, calls } = client([json({ error: "schedule sch_x not found" }, 404)]);
    await expect(bb.automations.schedules.delete("a/b", "sch x")).rejects.toBeInstanceOf(NotFoundError);
    expect(calls[0]!.url).toBe("https://bb.test/api/machines/a%2Fb/schedules/sch%20x");
  });
});

describe("automations.webhooks", () => {
  it("list / create / update / rotate / delete", async () => {
    const secretUrl = "https://bb.test/hooks/wh_1a2b3c4d5e6f/AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    const { bb, calls } = client([json([webhook]), json({ ...webhook, url: secretUrl }, 201), json(webhook), json({ ...webhook, url: secretUrl }), json({ id: webhook.id, deleted: true })]);
    await bb.automations.webhooks.list("abc");
    expect((await bb.automations.webhooks.create("abc", { action: { type: "tool", tool: "browser_navigate", passInput: true }, mode: "async" })).url).toBe(secretUrl);
    await bb.automations.webhooks.update("abc", webhook.id, { enabled: false, mode: "sync" });
    expect((await bb.automations.webhooks.rotate("abc", webhook.id)).url).toBe(secretUrl);
    await bb.automations.webhooks.delete("abc", webhook.id);
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", `${base}/webhooks`, undefined],
      ["POST", `${base}/webhooks`, { action: { type: "tool", tool: "browser_navigate", passInput: true }, mode: "async" }],
      ["PATCH", `${base}/webhooks/${webhook.id}`, { enabled: false, mode: "sync" }],
      ["POST", `${base}/webhooks/${webhook.id}/rotate`, {}],
      ["DELETE", `${base}/webhooks/${webhook.id}`, undefined],
    ]);
  });

  it("call: POSTs JSON without the API key and returns the raw Response", async () => {
    const url = "https://bb.test/hooks/wh_1a2b3c4d5e6f/secretsecretsecretsecret";
    const { bb, calls } = client([json({ runId: "run_1", status: "ok", output: "hi" })]);
    const res = await bb.automations.webhooks.call(url, { body: { q: 1 }, query: { a: "b" }, headers: { "x-test": "1" } });
    expect(res).toBeInstanceOf(Response);
    expect(await res.json()).toEqual({ runId: "run_1", status: "ok", output: "hi" });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${url}?a=b`);
    expect(calls[0]!.body).toEqual({ q: 1 });
    expect(calls[0]!.headers.authorization).toBeUndefined();
    expect(calls[0]!.headers["content-type"]).toBe("application/json");
    expect(calls[0]!.headers["x-test"]).toBe("1");
  });

  it("call: non-2xx is returned, not thrown, and never retried", async () => {
    const { bb, calls } = client([json({ runId: "run_1", status: "error", output: "boom" }, 502)], { maxRetries: 3 });
    const res = await bb.automations.webhooks.call("https://bb.test/hooks/wh_1/x", { method: "PUT", body: "raw text" });
    expect(res.status).toBe(502);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.body).toBe("raw text");
  });

  it("call: GET sends no body", async () => {
    const { bb, calls } = client([new Response("ok", { status: 200 })]);
    const res = await bb.automations.webhooks.call("https://bb.test/hooks/wh_1/x", { method: "GET", body: { ignored: true } });
    expect(await res.text()).toBe("ok");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.body).toBeUndefined();
  });
});

describe("automations.runs", () => {
  it("passes limit, and none by default", async () => {
    const run = { id: "run_1", source: "manual", sourceId: "sch_1", status: "ok", output: "", startedAt: 1, finishedAt: 2, durationMs: 1 };
    const { bb, calls } = client([json([run])]);
    expect(await bb.automations.runs("abc", { limit: 10 })).toEqual([run]);
    await bb.automations.runs("abc");
    expect(calls.map((c) => c.url)).toEqual([`${base}/runs?limit=10`, `${base}/runs`]);
  });
});
