import { describe, expect, it } from "vitest";
import { BadRequestError, NotFoundError, ServerError } from "../src/index.js";
import { client, json, machineFixture } from "./helpers.js";

const base = "https://bb.test/api/pools";
const pool = {
  id: "pool_3fa91c",
  name: "support",
  size: "small",
  screen: "1440x900",
  browser: "light",
  target: 3,
  ready: 2,
  warming: 1,
  setup: [{ type: "tool", tool: "apps_install", arguments: { kind: "apt", packages: ["gimp"] } }],
  paused: false,
  setupFailures: 0,
  lastSetup: { at: 1790797200000, ok: true, machineId: "7c1e40a2f9", durationMs: 41200, output: "### step 1/1 · ok" },
  createdAt: 1,
};

describe("pools", () => {
  it("list / get", async () => {
    const { bb, calls } = client([json([pool]), json(pool)]);
    expect(await bb.pools.list()).toEqual([pool]);
    expect(await bb.pools.get(pool)).toEqual(pool);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", base],
      ["GET", `${base}/pool_3fa91c`],
    ]);
  });

  it("create → POST /api/pools (201), {} by default", async () => {
    const { bb, calls } = client([json(pool, 201)]);
    const params = { name: "support", size: "small" as const, target: 3, browser: "full" as const, setup: pool.setup as never };
    expect(await bb.pools.create(params)).toEqual(pool);
    await bb.pools.create();
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["POST", base, params],
      ["POST", base, {}],
    ]);
  });

  it("update / resume → PATCH", async () => {
    const { bb, calls } = client([json(pool)]);
    await bb.pools.update("pool_3fa91c", { target: 5, setup: null });
    await bb.pools.update("pool_3fa91c");
    await bb.pools.resume(pool);
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["PATCH", `${base}/pool_3fa91c`, { target: 5, setup: null }],
      ["PATCH", `${base}/pool_3fa91c`, {}],
      ["PATCH", `${base}/pool_3fa91c`, {}],
    ]);
  });

  it("delete → DELETE, never retried", async () => {
    const { bb, calls } = client([json({ error: "internal error" }, 500), json({ id: "pool_3fa91c", deleted: true, destroyedMachines: 2 })], { maxRetries: 3 });
    await expect(bb.pools.delete("pool_3fa91c")).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveLength(1);
    expect(await bb.pools.delete(pool)).toEqual({ id: "pool_3fa91c", deleted: true, destroyedMachines: 2 });
    expect(calls[1]!.method).toBe("DELETE");
    expect(calls[1]!.url).toBe(`${base}/pool_3fa91c`);
  });

  it("claim → POST /claim; 200 fromPool or 201 booted", async () => {
    const { bb, calls } = client([json({ ...machineFixture, fromPool: true }, 200), json({ ...machineFixture, fromPool: false, setup: "pending" }, 201)]);
    const params = { name: "acme", externalId: "cus_1", labels: { plan: "pro" }, ttlMinutes: 60, onExpire: "destroy" as const, vpn: { country: "de" } };
    const a = await bb.pools.claim("pool_3fa91c", params);
    expect(a.fromPool).toBe(true);
    expect(a.mcpToken).toBe("tmm_abc");
    expect(a.setup).toBeUndefined();
    const b = await bb.pools.claim(pool);
    expect(b.fromPool).toBe(false);
    expect(b.setup).toBe("pending");
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["POST", `${base}/pool_3fa91c/claim`, params],
      ["POST", `${base}/pool_3fa91c/claim`, {}],
    ]);
  });

  it("claim is not retried", async () => {
    const { bb, calls } = client([json({ error: "internal error" }, 503)], { maxRetries: 3 });
    await expect(bb.pools.claim("pool_3fa91c")).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveLength(1);
  });

  it("maps 404 and 400", async () => {
    const { bb } = client([json({ error: "pool pool_000000 not found" }, 404), json({ error: "target must be 0-10" }, 400)]);
    await expect(bb.pools.get("pool_000000")).rejects.toBeInstanceOf(NotFoundError);
    await expect(bb.pools.update("pool_3fa91c", { target: 11 })).rejects.toThrow(BadRequestError);
  });
});
