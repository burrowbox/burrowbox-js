import { describe, expect, it } from "vitest";
import { NotFoundError, RateLimitError } from "../src/index.js";
import { client, json } from "./helpers.js";

const base = "https://bb.test/api/event-webhooks";
const endpoint = { id: "ep_1a2b3c4d5e6f", url: "https://example.com/hook", description: null, events: ["*"], enabled: true, createdAt: 1 };

describe("events.endpoints", () => {
  it("list / create / update / rotateSecret / test / delete", async () => {
    const { bb, calls } = client([
      json([endpoint]),
      json({ ...endpoint, secret: "whsec_a" }, 201),
      json({ ...endpoint, enabled: false }),
      json({ ...endpoint, secret: "whsec_b" }),
      json({ ok: false, status: 500, error: "HTTP 500" }),
      json({ id: endpoint.id, deleted: true }),
    ]);
    expect(await bb.events.endpoints.list()).toEqual([endpoint]);
    expect((await bb.events.endpoints.create({ url: endpoint.url, events: ["machine.stopped", "run.failed"], description: "prod" })).secret).toBe("whsec_a");
    expect((await bb.events.endpoints.update(endpoint.id, { enabled: false })).enabled).toBe(false);
    expect((await bb.events.endpoints.rotateSecret(endpoint.id)).secret).toBe("whsec_b");
    expect(await bb.events.endpoints.test(endpoint.id)).toEqual({ ok: false, status: 500, error: "HTTP 500" });
    expect(await bb.events.endpoints.delete(endpoint.id)).toEqual({ id: endpoint.id, deleted: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", base, undefined],
      ["POST", base, { url: endpoint.url, events: ["machine.stopped", "run.failed"], description: "prod" }],
      ["PATCH", `${base}/${endpoint.id}`, { enabled: false }],
      ["POST", `${base}/${endpoint.id}/rotate-secret`, {}],
      ["POST", `${base}/${endpoint.id}/test`, {}],
      ["DELETE", `${base}/${endpoint.id}`, undefined],
    ]);
    expect(calls[0]!.headers.authorization).toBe("Bearer tmk_test");
  });

  it("maps the 10-endpoint limit to RateLimitError and 404s to NotFoundError", async () => {
    const { bb } = client([json({ error: "at most 10 event webhooks" }, 429), json({ error: "event webhook ep_x not found" }, 404)]);
    await expect(bb.events.endpoints.create({ url: endpoint.url })).rejects.toBeInstanceOf(RateLimitError);
    await expect(bb.events.endpoints.update("ep_x", { url: endpoint.url })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("events.deliveries", () => {
  it("filters by endpoint and limit", async () => {
    const delivery = { id: "dlv_1", endpointId: endpoint.id, eventId: "evt_1", type: "test", status: "delivered", attempts: 1, responseStatus: 200, lastError: null, createdAt: 1, deliveredAt: 2 };
    const { bb, calls } = client([json([delivery])]);
    expect(await bb.events.deliveries({ endpoint: endpoint.id, limit: 20 })).toEqual([delivery]);
    await bb.events.deliveries();
    expect(calls.map((c) => c.url)).toEqual([`${base}/deliveries?endpoint=${endpoint.id}&limit=20`, `${base}/deliveries`]);
  });
});
