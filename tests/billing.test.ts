import { describe, expect, it } from "vitest";
import { Burrowbox, ServerError } from "../src/index.js";
import { client, json, mockFetch } from "./helpers.js";

const base = "https://bb.test/api";
const pricing = {
  currency: "usd",
  runningCentsPerHour: { tiny: 7, small: 11, medium: 16, large: 26 },
  stoppedCentsPerHour: 1,
  signupCreditCents: 500,
  topUpOptionsCents: [1000, 2500, 5000, 10000],
  minTopUpCents: 500,
  maxTopUpCents: 100000,
  provider: "stripe",
  vpn: null,
};
const cardInfo = {
  card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 },
  required: true,
  autoRefill: { thresholdCents: 500, amountCents: 2000, paused: false, error: null, thresholdOptions: [100, 200], amountOptions: [1000, 2000] },
};

describe("billing", () => {
  it("get / ledger / usage build the right requests", async () => {
    const summary = { balanceMicros: 1, burnMicrosPerHour: 0, runwayHours: null, usedThisMonthMicros: 0, addedThisMonthMicros: 0, machines: { running: 0, stopped: 0 }, pricing };
    const { bb, calls } = client([json(summary), json([]), json([]), json({ from: 1, to: 2, groupBy: "machine", totalMicros: 0, groups: [] }), json({})]);
    expect(await bb.billing.get()).toEqual(summary);
    await bb.billing.ledger({ limit: 20, offset: 40, kind: "credit" });
    await bb.billing.ledger();
    await bb.billing.usage({ groupBy: "machine", from: 1, to: 2 });
    await bb.billing.usage();
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["GET", `${base}/billing`],
      ["GET", `${base}/billing/ledger?limit=20&offset=40&kind=credit`],
      ["GET", `${base}/billing/ledger`],
      ["GET", `${base}/usage?groupBy=machine&from=1&to=2`],
      ["GET", `${base}/usage`],
    ]);
  });

  it("setAutoRefill → PUT, topUp → POST (not retried)", async () => {
    const { bb, calls } = client([json(cardInfo), json({ url: "https://checkout.stripe.com/c/pay/cs_1", mode: "stripe" })]);
    expect(await bb.billing.setAutoRefill({ thresholdCents: 500 })).toEqual(cardInfo);
    expect(await bb.billing.topUp({ cents: 2500 })).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_1", mode: "stripe" });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["PUT", `${base}/billing/auto-refill`, { thresholdCents: 500 }],
      ["POST", `${base}/billing/topup`, { cents: 2500 }],
    ]);

    const failing = client([json({ error: "Payments are not configured (set STRIPE_SECRET_KEY)" }, 503)], { maxRetries: 3 });
    await expect(failing.bb.billing.topUp({ cents: 2500 })).rejects.toBeInstanceOf(ServerError);
    expect(failing.calls).toHaveLength(1);
  });

  it("card get / checkout / remove", async () => {
    const { bb, calls } = client([json(cardInfo), json({ url: "https://checkout.stripe.com/c/pay/cs_2" }), json({ removed: true })]);
    expect(await bb.billing.card.get()).toEqual(cardInfo);
    expect(await bb.billing.card.checkout()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_2" });
    expect(await bb.billing.card.remove()).toEqual({ removed: true });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ["GET", `${base}/billing/card`, undefined],
      ["POST", `${base}/billing/card`, {}],
      ["DELETE", `${base}/billing/card`, undefined],
    ]);
  });

  it("pricing is public: no Authorization header, works without a key", async () => {
    const pub = { ...pricing, sizes: { tiny: { instance: "lite", cpus: 0.5, memoryMb: 4096, diskGb: 8 } }, signup: true };
    const { bb, calls } = client([json(pub)]);
    expect(await bb.billing.pricing()).toEqual(pub);
    expect(calls[0]!.url).toBe(`${base}/pricing`);
    expect(calls[0]!.headers.authorization).toBeUndefined();

    const m = mockFetch(json(pub));
    const anon = new Burrowbox({ apiKey: "", baseUrl: "https://bb.test", fetch: m.fetch });
    expect((await anon.billing.pricing()).signup).toBe(true);
  });
});
