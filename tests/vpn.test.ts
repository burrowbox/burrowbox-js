import { describe, expect, it } from "vitest";
import { BadRequestError, Burrowbox } from "../src/index.js";
import { client, json, machineFixture, mockFetch } from "./helpers.js";

const base = "https://bb.test/api/machines";
const locations = {
  available: true,
  types: [
    { type: "proxy", name: "Proxy", description: "…", available: true, cityTargeting: true, pricing: { centsPerHour: 3, centsPerGb: 1000, centsPer1kConnections: 0 } },
    { type: "unlock", name: "Unlock", description: "…", available: false, cityTargeting: false, pricing: { centsPerHour: 6, centsPerGb: 1500, centsPer1kConnections: 300 } },
  ],
  locations: [{ country: "de", name: "Germany" }],
  countries: [{ code: "de", name: "Germany" }],
  note: "Any two-letter country code works",
};

describe("vpn", () => {
  it("locations → GET /api/vpn/locations without auth", async () => {
    const { bb, calls } = client([json(locations)]);
    expect(await bb.vpn.locations()).toEqual(locations);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe("https://bb.test/api/vpn/locations");
    expect(calls[0]!.headers.authorization).toBeUndefined();
  });

  it("locations works with no API key at all", async () => {
    const m = mockFetch(json(locations));
    const bb = new Burrowbox({ baseUrl: "https://bb.test", fetch: m.fetch, maxRetries: 0, apiKey: undefined });
    await bb.vpn.locations();
    expect(m.calls[0]!.headers.authorization).toBeUndefined();
  });

  it("get → GET /vpn", async () => {
    const status = { vpn: { type: "proxy", country: "de" }, egress: { ok: true, ip: "203.0.113.7", country: "DE", city: "Berlin", org: "AS1 Example" } };
    const { bb, calls } = client([json(status)]);
    expect(await bb.vpn.get(machineFixture)).toEqual(status);
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.url).toBe(`${base}/2f6aeedcd3/vpn`);
  });

  it("set / disable → PUT /vpn with { vpn }", async () => {
    const res = { ...machineFixture, vpn: { type: "proxy", country: "us", city: "newyork" }, applied: true };
    const { bb, calls } = client([json(res), json({ ...machineFixture, applied: false, note: "takes effect when the machine starts" })]);
    expect(await bb.vpn.set("abc", { type: "proxy", country: "us", city: "newyork" })).toEqual(res);
    const off = await bb.vpn.disable("abc");
    expect(off.applied).toBe(false);
    expect(off.note).toBe("takes effect when the machine starts");
    await bb.vpn.set("abc", { city: null });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["PUT", `${base}/abc/vpn`, { vpn: { type: "proxy", country: "us", city: "newyork" } }],
      ["PUT", `${base}/abc/vpn`, { vpn: null }],
      ["PUT", `${base}/abc/vpn`, { vpn: { city: null } }],
    ]);
  });

  it("maps 400 for an invalid country", async () => {
    const { bb } = client([json({ error: "vpn.country must be a two-letter country code, e.g. us" }, 400)]);
    const err = await bb.vpn.set("abc", { country: "germany" }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.status).toBe(400);
  });
});
