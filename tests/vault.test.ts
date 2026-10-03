import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError } from "../src/index.js";
import { client, json, machineFixture } from "./helpers.js";

const base = "https://bb.test/api/machines";
const cred = { name: "github", url: "https://github.com/login", username: "bot@acme.com", hasPassword: true, hasTotp: true, updatedAt: "2026-10-03T12:00:00.000Z" };

describe("vault", () => {
  it("list → GET /vault", async () => {
    const { bb, calls } = client([json([cred])]);
    const list = await bb.vault.list(machineFixture);
    expect(list).toEqual([cred]);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(`${base}/2f6aeedcd3/vault`);
    expect(calls[0]!.body).toBeUndefined();
  });

  it("set → PUT /vault/{name} with the params", async () => {
    const { bb, calls } = client([json(cred)]);
    const params = { url: "https://github.com/login", username: "bot@acme.com", password: "hunter2", totpSecret: "JBSWY3DPEHPK3PXP", notes: "bot" };
    const res = await bb.vault.set("abc", "github", params);
    expect(res).toEqual(cred);
    expect(res).not.toHaveProperty("password");
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe(`${base}/abc/vault/github`);
    expect(calls[0]!.body).toEqual(params);
  });

  it("encodes the credential name", async () => {
    const { bb, calls } = client([json(cred)]);
    await bb.vault.set("abc", "acme/prod login", { password: "x" });
    expect(calls[0]!.url).toBe(`${base}/abc/vault/acme%2Fprod%20login`);
  });

  it("delete → DELETE /vault/{name}", async () => {
    const { bb, calls } = client([json({ deleted: true }), json({ deleted: false })]);
    expect(await bb.vault.delete("abc", "github")).toEqual({ deleted: true });
    expect(await bb.vault.delete("abc", "missing")).toEqual({ deleted: false });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["DELETE", `${base}/abc/vault/github`],
      ["DELETE", `${base}/abc/vault/missing`],
    ]);
  });

  it("409 when the machine is stopped, 404 when it isn't yours", async () => {
    const { bb } = client([json({ error: "machine is stopped" }, 409), json({ error: "machine not found" }, 404)]);
    const err = await bb.vault.list("abc").catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe("machine is stopped");
    await expect(bb.vault.set("abc", "x", {})).rejects.toBeInstanceOf(NotFoundError);
  });
});
