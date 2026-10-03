// Imports the BUILT package through its own "exports" map (ESM) and exercises it without network.
import assert from "node:assert/strict";
import { Burrowbox, NotFoundError, VERSION, signWebhookPayload, verifyWebhookSignature } from "burrowbox";

const fetch = async (url) =>
  url.endsWith("/api/billing")
    ? Response.json({ balanceMicros: 1 })
    : Response.json({ error: "machine not found" }, { status: 404 });
const bb = new Burrowbox({ apiKey: "tmk_smoke", baseUrl: "https://bb.test", fetch, maxRetries: 0 });

assert.equal((await bb.billing.get()).balanceMicros, 1);
await assert.rejects(bb.machines.get("nope"), NotFoundError);
const header = await signWebhookPayload("{}", "whsec_smoke", 1_700_000_000);
assert.equal(await verifyWebhookSignature("{}", header, "whsec_smoke", { now: 1_700_000_000 }), true);
console.log(`ESM ok: burrowbox ${VERSION} on Node ${process.versions.node}`);
