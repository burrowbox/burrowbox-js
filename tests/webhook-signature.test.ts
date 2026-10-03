import { describe, expect, it } from "vitest";
import { WebhookSignatureError, constructWebhookEvent, signWebhookPayload, verifyWebhookSignature } from "../src/index.js";

/**
 * Exactly how the server signs deliveries (packages/api/src/events.ts → util.ts `hmacSha256Hex`):
 * HMAC-SHA256 keyed with the full `whsec_…` string over `${t}.${payload}`, hex-encoded, sent as
 * `burrowbox-signature: t=${t},v1=${sig}`.
 */
const enc = new TextEncoder();
async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function serverHeader(secret: string, payload: string, t: number) {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${payload}`)}`;
}

const secret = "whsec_testsecret0123456789abcdefghijkl";
const t = 1790797200;
const payload = JSON.stringify({ id: "evt_91ab34cd56ef7890", type: "test", createdAt: "2026-09-30T12:00:00.000Z", data: { message: "Test event from Burrowbox" } });
const machinePayload = JSON.stringify({
  id: "evt_0011223344556677",
  type: "machine.stopped",
  createdAt: "2026-09-30T12:00:00.000Z",
  data: { machine: { id: "2f6aeedcd3", name: "acmé ✓", status: "stopped", size: "tiny", externalId: "cus_8f2a", labels: { plan: "pro" } }, detail: { reason: "expired" } },
});
const opts = { now: t };

describe("webhook signatures", () => {
  it("matches an independently computed vector (openssl dgst -sha256 -hmac)", async () => {
    expect(await serverHeader(secret, payload, t)).toBe("t=1790797200,v1=48934227ee31dac76ae37e1e0d2a7fed33f045c7b7895e2a5c6823dde836ac59");
    expect(await signWebhookPayload(payload, secret, t)).toBe("t=1790797200,v1=48934227ee31dac76ae37e1e0d2a7fed33f045c7b7895e2a5c6823dde836ac59");
  });

  it("verifies server-signed payloads given as string, Uint8Array and ArrayBuffer", async () => {
    const header = await serverHeader(secret, machinePayload, t);
    const bytes = enc.encode(machinePayload);
    expect(await verifyWebhookSignature(machinePayload, header, secret, opts)).toBe(true);
    expect(await verifyWebhookSignature(bytes, header, secret, opts)).toBe(true);
    expect(await verifyWebhookSignature(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), header, secret, opts)).toBe(true);
  });

  it("signWebhookPayload produces what the server would send", async () => {
    expect(await signWebhookPayload(machinePayload, secret, t)).toBe(await serverHeader(secret, machinePayload, t));
    expect(await signWebhookPayload(enc.encode(machinePayload), secret, t)).toBe(await serverHeader(secret, machinePayload, t));
  });

  it("signWebhookPayload defaults to the current time", async () => {
    const header = await signWebhookPayload(payload, secret);
    const ts = Number(/^t=(\d+),v1=[0-9a-f]{64}$/.exec(header)?.[1]);
    expect(Math.abs(ts - Date.now() / 1000)).toBeLessThan(5);
    expect(await verifyWebhookSignature(payload, header, secret)).toBe(true);
  });

  it("rejects a wrong secret, a modified body and a re-serialized body", async () => {
    const header = await serverHeader(secret, machinePayload, t);
    expect(await verifyWebhookSignature(machinePayload, header, "whsec_other", opts)).toBe(false);
    expect(await verifyWebhookSignature(machinePayload.replace("stopped", "started"), header, secret, opts)).toBe(false);
    expect(await verifyWebhookSignature(JSON.stringify(JSON.parse(machinePayload), null, 2), header, secret, opts)).toBe(false);
    // the key is the full whsec_ string, not the part after the prefix
    expect(await verifyWebhookSignature(machinePayload, header, secret.slice("whsec_".length), opts)).toBe(false);
  });

  it("enforces the timestamp tolerance in both directions", async () => {
    const header = await serverHeader(secret, payload, t);
    expect(await verifyWebhookSignature(payload, header, secret, { now: t + 300 })).toBe(true);
    expect(await verifyWebhookSignature(payload, header, secret, { now: t - 300 })).toBe(true);
    expect(await verifyWebhookSignature(payload, header, secret, { now: t + 301 })).toBe(false);
    expect(await verifyWebhookSignature(payload, header, secret, { now: t - 301 })).toBe(false);
    expect(await verifyWebhookSignature(payload, header, secret, { now: t + 3600, toleranceSeconds: 3600 })).toBe(true);
    // default "now" is the real clock, and this fixture is from the past/future
    expect(await verifyWebhookSignature(payload, header, secret)).toBe(Math.abs(Date.now() / 1000 - t) <= 300);
  });

  it("accepts any matching v1 among several, ignores unknown schemes and whitespace", async () => {
    const good = (await serverHeader(secret, payload, t)).split(",")[1]!;
    const bad = `v1=${"0".repeat(64)}`;
    expect(await verifyWebhookSignature(payload, `t=${t}, ${bad}, v0=abc, ${good}`, secret, opts)).toBe(true);
    expect(await verifyWebhookSignature(payload, `t=${t},${good.toUpperCase().replace("V1", "v1")}`, secret, opts)).toBe(true);
  });

  it("returns false (never throws) for missing or malformed headers", async () => {
    for (const h of [undefined, null, "", "   ", "garbage", `t=${t}`, `v1=${"a".repeat(64)}`, `t=abc,v1=${"a".repeat(64)}`, `t=${t},v1=xyz`, `t=${t},v1=${"a".repeat(63)}`]) {
      expect(await verifyWebhookSignature(payload, h, secret, opts)).toBe(false);
    }
    expect(await verifyWebhookSignature(payload, await serverHeader(secret, payload, t), "", opts)).toBe(false);
    expect(await verifyWebhookSignature(123 as unknown as string, await serverHeader(secret, payload, t), secret, opts)).toBe(false);
  });

  it("constructWebhookEvent verifies and parses", async () => {
    const header = await serverHeader(secret, machinePayload, t);
    const event = await constructWebhookEvent(enc.encode(machinePayload), header, secret, opts);
    expect(event.type).toBe("machine.stopped");
    if (event.type === "machine.stopped") expect(event.data.machine.name).toBe("acmé ✓");
  });

  it("constructWebhookEvent throws WebhookSignatureError with a clear reason", async () => {
    const header = await serverHeader(secret, payload, t);
    const reason = async (p: Promise<unknown>) => {
      const err = await p.then(() => undefined, (e: unknown) => e);
      expect(err).toBeInstanceOf(WebhookSignatureError);
      expect((err as WebhookSignatureError).code).toBe("invalid_signature");
      expect((err as WebhookSignatureError).status).toBeUndefined();
      return (err as Error).message;
    };
    expect(await reason(constructWebhookEvent(payload, undefined, secret, opts))).toMatch(/Missing Burrowbox-Signature/);
    expect(await reason(constructWebhookEvent(payload, `v1=${"a".repeat(64)}`, secret, opts))).toMatch(/no timestamp/);
    expect(await reason(constructWebhookEvent(payload, `t=${t}`, secret, opts))).toMatch(/no v1 signature/);
    expect(await reason(constructWebhookEvent(payload, header, secret, { now: t + 1000 }))).toMatch(/tolerance/);
    expect(await reason(constructWebhookEvent(payload, header, "whsec_nope", opts))).toMatch(/does not match/);
    expect(await reason(constructWebhookEvent(payload, header, "", opts))).toMatch(/secret/);
    const notJson = "not json";
    expect(await reason(constructWebhookEvent(notJson, await serverHeader(secret, notJson, t), secret, opts))).toMatch(/not valid JSON/);
  });
});
