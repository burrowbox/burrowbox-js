import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../src/index.js";
import { client, json } from "./helpers.js";

const me = {
  id: "u_1",
  email: "dev@example.com",
  name: "Dev",
  role: "user",
  emailVerified: true,
  createdAt: 1,
  billing: null,
  payment: { required: true, card: null, autoRefillPaused: false },
};

describe("account", () => {
  it("get / update", async () => {
    const { bb, calls } = client([json(me), json({ ...me, name: "New" })]);
    expect(await bb.account.get()).toEqual(me);
    expect((await bb.account.update({ name: "New" })).name).toBe("New");
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", "https://bb.test/api/me", undefined],
      ["PATCH", "https://bb.test/api/me", { name: "New" }],
    ]);
  });

  it("a machine token gets 401 → AuthenticationError", async () => {
    const { bb } = client([json({ error: "unauthorized" }, 401)], { apiKey: "tmm_abc" });
    await expect(bb.account.get()).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe("account.apiKeys", () => {
  it("list / create / delete", async () => {
    const key = { id: "k_1a2b3c4d5e6f", name: "CI", prefix: "tmk_AbCdEf", createdAt: 1, lastUsedAt: null };
    const { bb, calls } = client([json([key]), json({ id: key.id, secret: "tmk_secret" }, 201), json({ id: key.id, secret: "tmk_s2" }, 201), json({ deleted: true })]);
    expect(await bb.account.apiKeys.list()).toEqual([key]);
    expect(await bb.account.apiKeys.create({ name: "CI" })).toEqual({ id: key.id, secret: "tmk_secret" });
    await bb.account.apiKeys.create();
    expect(await bb.account.apiKeys.delete(key.id)).toEqual({ deleted: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", "https://bb.test/api/keys", undefined],
      ["POST", "https://bb.test/api/keys", { name: "CI" }],
      ["POST", "https://bb.test/api/keys", {}],
      ["DELETE", `https://bb.test/api/keys/${key.id}`, undefined],
    ]);
  });
});
