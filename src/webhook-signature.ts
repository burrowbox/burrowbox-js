import { notImplemented } from "./resource.js";
import type { BurrowboxEvent, VerifySignatureOptions } from "./types/events.js";

/**
 * Event webhook signatures. Header: `Burrowbox-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 * Uses Web Crypto (`globalThis.crypto.subtle`), so it works in Node 18+, Bun, Deno, Workers and browsers.
 * Always pass the RAW request body (string or bytes), not re-serialized JSON.
 */

/** `true` when the signature is valid and the timestamp is within tolerance (default 300 s). Never throws for bad input. */
export async function verifyWebhookSignature(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifySignatureOptions = {},
): Promise<boolean> {
  throw notImplemented("verifyWebhookSignature");
}

/**
 * Verify and parse an event. Throws `WebhookSignatureError` when the header is missing, malformed,
 * doesn't match, or is outside the tolerance.
 */
export async function constructWebhookEvent(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifySignatureOptions = {},
): Promise<BurrowboxEvent> {
  throw notImplemented("constructWebhookEvent");
}

/** Build a `Burrowbox-Signature` header value (for tests and local tools). `timestamp` defaults to now (unix seconds). */
export async function signWebhookPayload(rawBody: string | Uint8Array | ArrayBuffer, secret: string, timestamp?: number): Promise<string> {
  throw notImplemented("signWebhookPayload");
}
