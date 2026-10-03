import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  BadRequestError,
  BurrowboxError,
  ConflictError,
  InsufficientCreditError,
  NotFoundError,
  PayloadTooLargeError,
  PermissionError,
  RateLimitError,
  ServerError,
  errorFromResponse,
} from "../src/index.js";

describe("errorFromResponse", () => {
  const cases: [number, new (...a: never[]) => BurrowboxError, string][] = [
    [400, BadRequestError, "bad_request"],
    [401, AuthenticationError, "authentication_error"],
    [402, InsufficientCreditError, "insufficient_credit"],
    [403, PermissionError, "permission_denied"],
    [404, NotFoundError, "not_found"],
    [409, ConflictError, "conflict"],
    [413, PayloadTooLargeError, "payload_too_large"],
    [429, RateLimitError, "rate_limited"],
    [500, ServerError, "server_error"],
    [502, ServerError, "server_error"],
    [503, ServerError, "server_error"],
  ];
  for (const [status, cls, code] of cases) {
    it(`${status} → ${cls.name}`, () => {
      const e = errorFromResponse(status, { error: "msg" });
      expect(e).toBeInstanceOf(cls);
      expect(e).toBeInstanceOf(BurrowboxError);
      expect(e).toBeInstanceOf(Error);
      expect(e.status).toBe(status);
      expect(e.code).toBe(code);
      expect(e.message).toBe("msg");
      expect(e.name).toBe(cls.name);
    });
  }

  it("falls back to a generic error and message", () => {
    const e = errorFromResponse(418, undefined);
    expect(e.constructor).toBe(BurrowboxError);
    expect(e.message).toBe("HTTP 418");
    expect(errorFromResponse(500, "plain text oops").message).toBe("plain text oops");
  });

  it("reads Retry-After on 429", () => {
    const e = errorFromResponse(429, { error: "slow" }, { headers: new Headers({ "retry-after": "7" }) }) as RateLimitError;
    expect(e.retryAfterSeconds).toBe(7);
  });
});
