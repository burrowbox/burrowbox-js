import { WebhookSignatureError } from "./errors.js";
import type { BurrowboxEvent, VerifySignatureOptions } from "./types/events.js";

/**
 * Event webhook signatures. Header: `Burrowbox-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 * Uses Web Crypto (`globalThis.crypto.subtle`), so it works in Node 18+, Bun, Deno, Workers and browsers.
 * Always pass the RAW request body (string or bytes), not re-serialized JSON.
 */

type RawBody = string | Uint8Array | ArrayBuffer;

const DEFAULT_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

function subtle(): SubtleCrypto {
  const s = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!s) {
    throw new Error(
      "Web Crypto (globalThis.crypto.subtle) is not available. On Node 18, start node with --experimental-global-webcrypto " +
        "or set globalThis.crypto = require('node:crypto').webcrypto.",
    );
  }
  return s;
}

function toBytes(body: RawBody): Uint8Array {
  if (typeof body === "string") return encoder.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  throw new WebhookSignatureError("The webhook body must be the raw request body as a string, Uint8Array or ArrayBuffer");
}

/** HMAC-SHA256 over `"<t>." + body` (byte-for-byte the server's `${t}.${payload}`), as lowercase hex. */
async function hmacHex(secret: string, timestamp: number, body: RawBody): Promise<string> {
  const prefix = encoder.encode(`${timestamp}.`);
  const bytes = toBytes(body);
  const message = new Uint8Array(prefix.length + bytes.length);
  message.set(prefix, 0);
  message.set(bytes, prefix.length);
  const s = subtle();
  const key = await s.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await s.sign("HMAC", key, message));
  let hex = "";
  for (const b of sig) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Compares two strings without short-circuiting on the first difference. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") {
      if (!/^\d{1,15}$/.test(value)) throw new WebhookSignatureError("Burrowbox-Signature has an invalid timestamp");
      timestamp = Number(value);
    } else if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }
  if (timestamp === undefined) throw new WebhookSignatureError("Burrowbox-Signature has no timestamp (t=…)");
  if (!signatures.length) throw new WebhookSignatureError("Burrowbox-Signature has no v1 signature");
  return { timestamp, signatures };
}

/** Throws a `WebhookSignatureError` describing why the signature is not acceptable. */
async function assertValid(rawBody: RawBody, signatureHeader: string | null | undefined, secret: string, options: VerifySignatureOptions): Promise<void> {
  if (typeof secret !== "string" || !secret) throw new WebhookSignatureError("A webhook signing secret (whsec_…) is required");
  if (typeof signatureHeader !== "string" || !signatureHeader.trim()) {
    throw new WebhookSignatureError("Missing Burrowbox-Signature header");
  }
  const { timestamp, signatures } = parseHeader(signatureHeader);

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookSignatureError(`Burrowbox-Signature timestamp is outside the ${tolerance} s tolerance`);
  }

  const expected = await hmacHex(secret, timestamp, rawBody);
  let match = false;
  for (const sig of signatures) match = timingSafeEqual(sig, expected) || match; // check all, no early exit
  if (!match) throw new WebhookSignatureError("Burrowbox-Signature does not match the payload (wrong secret, or the body was modified/re-serialized)");
}

/** `true` when the signature is valid and the timestamp is within tolerance (default 300 s). Never throws for bad input. */
export async function verifyWebhookSignature(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifySignatureOptions = {},
): Promise<boolean> {
  try {
    await assertValid(rawBody, signatureHeader, secret, options);
    return true;
  } catch (err) {
    if (err instanceof WebhookSignatureError) return false;
    throw err; // e.g. no Web Crypto in this runtime
  }
}

/**
 * Verify and parse an event. Throws `WebhookSignatureError` when the header is missing, malformed,
 * doesn't match, or is outside the tolerance (and when a correctly signed body isn't JSON).
 */
export async function constructWebhookEvent(
  rawBody: string | Uint8Array | ArrayBuffer,
  signatureHeader: string | null | undefined,
  secret: string,
  options: VerifySignatureOptions = {},
): Promise<BurrowboxEvent> {
  await assertValid(rawBody, signatureHeader, secret, options);
  const text = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(toBytes(rawBody));
  try {
    return JSON.parse(text) as BurrowboxEvent;
  } catch (err) {
    throw new WebhookSignatureError("The webhook body is not valid JSON", { cause: err });
  }
}

/** Build a `Burrowbox-Signature` header value (for tests and local tools). `timestamp` defaults to now (unix seconds). */
export async function signWebhookPayload(rawBody: string | Uint8Array | ArrayBuffer, secret: string, timestamp?: number): Promise<string> {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(t) || t < 0) throw new TypeError("timestamp must be a non-negative integer (unix seconds)");
  return `t=${t},v1=${await hmacHex(secret, t, rawBody)}`;
}
