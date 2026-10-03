import { describe, expect, it } from "vitest";
import { ConflictError, InsufficientCreditError, TimeoutError } from "../src/index.js";
import { client, json, machineFixture } from "./helpers.js";

const M = machineFixture;
const base = "https://bb.test/api/machines";

describe("machines", () => {
  it("create → POST /api/machines with the body", async () => {
    const { bb, calls } = client([json(M, 201)]);
    const m = await bb.machines.create({ name: "acme", size: "tiny", ttlMinutes: 60, externalId: "cus_1", labels: { plan: "pro" }, vpn: { country: "de" } });
    expect(m.mcpToken).toBe("tmm_abc");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(base);
    expect(calls[0]!.body).toEqual({ name: "acme", size: "tiny", ttlMinutes: 60, externalId: "cus_1", labels: { plan: "pro" }, vpn: { country: "de" } });
  });

  it("create with no params sends {}", async () => {
    const { bb, calls } = client([json(M, 201)]);
    await bb.machines.create();
    expect(calls[0]!.body).toEqual({});
  });

  it("create surfaces 402 as InsufficientCreditError and is not retried", async () => {
    const { bb, calls } = client([json({ error: "Your balance is empty" }, 402)], { maxRetries: 3 });
    await expect(bb.machines.create()).rejects.toBeInstanceOf(InsufficientCreditError);
    expect(calls).toHaveLength(1);
  });

  it("list builds filters", async () => {
    const { bb, calls } = client([json([M])]);
    const list = await bb.machines.list({ externalId: "cus_8f2a", labels: { region: "eu", plan: "pro" }, includePooled: true });
    expect(list).toHaveLength(1);
    const u = new URL(calls[0]!.url);
    expect(u.pathname).toBe("/api/machines");
    expect(u.searchParams.get("externalId")).toBe("cus_8f2a");
    expect(u.searchParams.get("label.region")).toBe("eu");
    expect(u.searchParams.get("label.plan")).toBe("pro");
    expect(u.searchParams.get("includePooled")).toBe("1");
  });

  it("list without filters has no query", async () => {
    const { bb, calls } = client([json([])]);
    await bb.machines.list();
    expect(calls[0]!.url).toBe(base);
  });

  it("get accepts an id or a machine object", async () => {
    const { bb, calls } = client([json(M)]);
    await bb.machines.get("2f6aeedcd3");
    await bb.machines.get(M);
    expect(calls.map((c) => c.url)).toEqual([`${base}/2f6aeedcd3`, `${base}/2f6aeedcd3`]);
    expect(calls[0]!.method).toBe("GET");
  });

  it("update / schedule → PATCH", async () => {
    const { bb, calls } = client([json(M)]);
    await bb.machines.update("abc", { name: "x", labels: null, autoUpdate: false });
    await bb.machines.schedule("abc", null);
    await bb.machines.schedule("abc", 120, "destroy");
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["PATCH", `${base}/abc`, { name: "x", labels: null, autoUpdate: false }],
      ["PATCH", `${base}/abc`, { ttlMinutes: null }],
      ["PATCH", `${base}/abc`, { ttlMinutes: 120, onExpire: "destroy" }],
    ]);
  });

  it("start / stop", async () => {
    const { bb, calls } = client([json(M)]);
    await bb.machines.start("abc", { ttlMinutes: 30 });
    await bb.machines.start("abc");
    await bb.machines.stop("abc");
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["POST", `${base}/abc/start`, { ttlMinutes: 30 }],
      ["POST", `${base}/abc/start`, {}],
      ["POST", `${base}/abc/stop`, {}],
    ]);
  });

  it("destroy / delete → DELETE, never retried", async () => {
    const { bb, calls } = client([json({ error: "oops" }, 500), json({ id: "abc", destroyed: true })], { maxRetries: 3 });
    await expect(bb.machines.destroy("abc")).rejects.toThrow("oops");
    expect(calls).toHaveLength(1);
    expect(await bb.machines.delete("abc")).toEqual({ id: "abc", destroyed: true });
    expect(calls[1]!.method).toBe("DELETE");
    expect(calls[1]!.url).toBe(`${base}/abc`);
  });

  it("resize, browser, updateAgent", async () => {
    const { bb, calls } = client([json({ ...M, applied: true })]);
    await bb.machines.resize("abc", "medium");
    await bb.machines.setBrowser("abc", "full");
    await bb.machines.getBrowser("abc");
    await bb.machines.updateAgent("abc");
    await bb.machines.updateAgent("abc", { restart: false });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["POST", `${base}/abc/resize`, { size: "medium" }],
      ["PUT", `${base}/abc/browser`, { browser: "full" }],
      ["GET", `${base}/abc/browser`, undefined],
      ["POST", `${base}/abc/update`, {}],
      ["POST", `${base}/abc/update`, { restart: false }],
    ]);
  });

  it("events, apps, windows, launchApp", async () => {
    const { bb, calls } = client([json([])]);
    await bb.machines.events("abc");
    await bb.machines.apps("abc");
    await bb.machines.windows("abc");
    await bb.machines.launchApp("abc", { app: "gimp" });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", `${base}/abc/events`],
      ["GET", `${base}/abc/apps`],
      ["GET", `${base}/abc/windows`],
      ["POST", `${base}/abc/apps/launch`],
    ]);
    expect(calls[3]!.body).toEqual({ app: "gimp" });
  });

  it("screenshot returns bytes; 409 when stopped", async () => {
    const { bb, calls } = client([new Response(new Uint8Array([0xff, 0xd8]), { headers: { "content-type": "image/jpeg" } }), json({ error: "machine is stopped" }, 409)]);
    const img = await bb.machines.screenshot("abc", { quality: 60 });
    expect(img).toBeInstanceOf(Uint8Array);
    expect(Array.from(img)).toEqual([0xff, 0xd8]);
    expect(calls[0]!.url).toBe(`${base}/abc/screenshot.jpg?q=60`);
    await expect(bb.machines.browserScreenshot("abc")).rejects.toBeInstanceOf(ConflictError);
    expect(calls[1]!.url).toBe(`${base}/abc/browser/screenshot.png`);
  });

  it("encodes ids in paths", async () => {
    const { bb, calls } = client([json(M)]);
    await bb.machines.get("../admin");
    expect(calls[0]!.url).toBe(`${base}/..%2Fadmin`);
  });

  it("waitForStatus polls until running", async () => {
    const { bb, calls } = client([json({ ...M, status: "starting" }), json({ ...M, status: "running" })]);
    const m = await bb.machines.waitForStatus("abc", "running", { intervalMs: 1 });
    expect(m.status).toBe("running");
    expect(calls).toHaveLength(2);
  });

  it("waitForStatus times out and fails on error status", async () => {
    const { bb } = client([json({ ...M, status: "starting" })]);
    await expect(bb.machines.waitForStatus("abc", "running", { intervalMs: 5, timeoutMs: 1 })).rejects.toBeInstanceOf(TimeoutError);
    const { bb: bb2 } = client([json({ ...M, status: "error", lastError: "boot failed" })]);
    await expect(bb2.machines.waitForStatus("abc")).rejects.toThrow("boot failed");
  });
});

describe("mcp", () => {
  it("platform() uses the API key", () => {
    const { bb } = client([]);
    expect(bb.mcp.platform()).toEqual({
      name: "burrowbox",
      url: "https://bb.test/mcp",
      token: "tmk_test",
      headers: { Authorization: "Bearer tmk_test" },
      transport: "http",
    });
  });

  it("machine() uses the token from the object without a request", async () => {
    const { bb, calls } = client([]);
    const cfg = await bb.machines.mcp(M);
    expect(calls).toHaveLength(0);
    expect(cfg).toMatchObject({ name: "burrowbox-2f6aeedcd3", url: "https://bb.test/api/machines/2f6aeedcd3/mcp", token: "tmm_abc" });
    expect(cfg.headers.Authorization).toBe("Bearer tmm_abc");
  });

  it("machine() fetches the token for an id", async () => {
    const { bb, calls } = client([json(M)]);
    const cfg = await bb.mcp.machine("2f6aeedcd3", { name: "my box" });
    expect(calls[0]!.url).toBe(`${base}/2f6aeedcd3`);
    expect(cfg.token).toBe("tmm_abc");
    expect(cfg.name).toBe("my-box");
  });

  it("machine() can use the API key, or a tmm_ client token", async () => {
    const { bb, calls } = client([]);
    expect((await bb.mcp.machine("abc", { useApiKey: true })).token).toBe("tmk_test");
    const { bb: bb2, calls: c2 } = client([], { apiKey: "tmm_mine" });
    expect((await bb2.mcp.machine("abc")).token).toBe("tmm_mine");
    expect(calls.length + c2.length).toBe(0);
  });

  it("converters", async () => {
    const { toAgentSdkMcpServers, toMessagesApiMcpServer, toClaudeCodeCommand } = await import("../src/index.js");
    const { bb } = client([]);
    const cfg = await bb.machines.mcp(M);
    expect(toAgentSdkMcpServers(cfg)).toEqual({
      "burrowbox-2f6aeedcd3": { type: "http", url: cfg.url, headers: { Authorization: "Bearer tmm_abc" } },
    });
    expect(toMessagesApiMcpServer(cfg)).toEqual({ type: "url", url: cfg.url, name: "burrowbox-2f6aeedcd3", authorization_token: "tmm_abc" });
    expect(toClaudeCodeCommand(cfg)).toBe(
      'claude mcp add --transport http burrowbox-2f6aeedcd3 https://bb.test/api/machines/2f6aeedcd3/mcp --header "Authorization: Bearer tmm_abc"',
    );
  });
});
