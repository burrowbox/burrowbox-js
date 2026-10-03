// Requires the BUILT package through its own "exports" map (CommonJS) and exercises it without network.
const assert = require("node:assert/strict");
const { Burrowbox, NotFoundError, VERSION, signWebhookPayload, verifyWebhookSignature } = require("burrowbox");

(async () => {
  const fetch = async () => Response.json({ error: "machine not found" }, { status: 404 });
  const bb = new Burrowbox({ apiKey: "tmk_smoke", baseUrl: "https://bb.test", fetch, maxRetries: 0 });
  await assert.rejects(bb.machines.get("nope"), NotFoundError);
  const header = await signWebhookPayload("{}", "whsec_smoke", 1_700_000_000);
  assert.equal(await verifyWebhookSignature("{}", header, "whsec_smoke", { now: 1_700_000_000 }), true);
  console.log(`CJS ok: burrowbox ${VERSION} on Node ${process.versions.node}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
