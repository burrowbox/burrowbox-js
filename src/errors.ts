/**
 * Errors thrown by the Burrowbox client.
 *
 * The API answers errors with JSON like `{ "error": "Your balance is empty — add credit to start machines" }`
 * and an HTTP status. Every HTTP error becomes a {@link BurrowboxError} subclass picked by status, so you
 * can `catch (e) { if (e instanceof NotFoundError) … }`.
 */

/** Stable, machine-readable error codes. The API only sends a message, so the code is derived from the status. */
export type BurrowboxErrorCode =
  | "bad_request"
  | "authentication_error"
  | "insufficient_credit"
  | "permission_denied"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "rate_limited"
  | "server_error"
  | "connection_error"
  | "timeout"
  | "invalid_signature"
  | "api_error";

export interface BurrowboxErrorOptions {
  status?: number | undefined;
  code?: BurrowboxErrorCode | undefined;
  /** Parsed JSON body (or raw text) of the error response. */
  body?: unknown;
  headers?: Headers | undefined;
  /** HTTP method and URL of the failed request. */
  method?: string | undefined;
  url?: string | undefined;
  cause?: unknown;
}

/** Base class for every error this library throws. */
export class BurrowboxError extends Error {
  /** HTTP status, or `undefined` for network errors, timeouts and signature errors. */
  readonly status: number | undefined;
  readonly code: BurrowboxErrorCode;
  /** The response body: usually `{ error: string }`. */
  readonly body: unknown;
  readonly headers: Headers | undefined;
  readonly method: string | undefined;
  readonly url: string | undefined;

  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code ?? "api_error";
    this.body = options.body;
    this.headers = options.headers;
    this.method = options.method;
    this.url = options.url;
  }
}

/** 400: invalid input (check the body fields). */
export class BadRequestError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "bad_request", ...options });
  }
}

/** 401: missing or invalid token, or a machine token used outside its own machine's MCP/live-view endpoints. */
export class AuthenticationError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "authentication_error", ...options });
  }
}

/** 402: the balance is empty or no card is on file. Top up (or save a card), then retry. */
export class InsufficientCreditError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "insufficient_credit", ...options });
  }
}

/** 403: not allowed (wrong origin, admin-only route). */
export class PermissionError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "permission_denied", ...options });
  }
}

/** 404: the machine, pool, schedule… doesn't exist or isn't yours. */
export class NotFoundError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "not_found", ...options });
  }
}

/** 409: the machine isn't running (or is busy starting/stopping), or a webhook is disabled. */
export class ConflictError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "conflict", ...options });
  }
}

/** 413: request body over 1 MB. */
export class PayloadTooLargeError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "payload_too_large", ...options });
  }
}

/** 429: too many attempts, or a limit was reached (machines per account, schedules per machine, event webhooks). */
export class RateLimitError extends BurrowboxError {
  /** Seconds to wait, from the `Retry-After` header when the server sends one. */
  readonly retryAfterSeconds: number | undefined;
  constructor(message: string, options: BurrowboxErrorOptions & { retryAfterSeconds?: number | undefined } = {}) {
    super(message, { code: "rate_limited", ...options });
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** 5xx: internal error (500), machine unreachable (502), temporarily unavailable (503). */
export class ServerError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "server_error", ...options });
  }
}

/** The request never got an HTTP response (DNS, TCP, TLS, connection reset…). */
export class ConnectionError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "connection_error", ...options });
  }
}

/** The request took longer than `timeoutMs`. */
export class TimeoutError extends ConnectionError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { ...options, code: "timeout" });
  }
}

/** An event webhook's `Burrowbox-Signature` header is missing, malformed, wrong or too old. */
export class WebhookSignatureError extends BurrowboxError {
  constructor(message: string, options: BurrowboxErrorOptions = {}) {
    super(message, { code: "invalid_signature", ...options });
  }
}

/** Extract the API's `{ error }` message from a response body. */
export function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error: unknown }).error;
    if (typeof e === "string" && e) return e;
  }
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 500);
  return `HTTP ${status}`;
}

function retryAfter(headers: Headers | undefined): number | undefined {
  const v = headers?.get("retry-after");
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, (at - Date.now()) / 1000) : undefined;
}

/** Build the right error subclass for an HTTP error response. */
export function errorFromResponse(
  status: number,
  body: unknown,
  extra: Omit<BurrowboxErrorOptions, "status" | "body" | "code"> = {},
): BurrowboxError {
  const message = errorMessage(body, status);
  const opts: BurrowboxErrorOptions = { ...extra, status, body };
  switch (status) {
    case 400:
      return new BadRequestError(message, opts);
    case 401:
      return new AuthenticationError(message, opts);
    case 402:
      return new InsufficientCreditError(message, opts);
    case 403:
      return new PermissionError(message, opts);
    case 404:
      return new NotFoundError(message, opts);
    case 409:
      return new ConflictError(message, opts);
    case 413:
      return new PayloadTooLargeError(message, opts);
    case 429:
      return new RateLimitError(message, { ...opts, retryAfterSeconds: retryAfter(extra.headers) });
    default:
      if (status >= 500) return new ServerError(message, opts);
      return new BurrowboxError(message, opts);
  }
}
