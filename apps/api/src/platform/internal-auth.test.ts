import {
  authorizeInternalRequest,
  isInternetFacingHostname,
  MIN_INTERNAL_API_KEY_LENGTH,
  verifyInternalApiKey,
} from "@seal/internal-auth";
import { describe, expect, it } from "vitest";

const STRONG_KEY = "a".repeat(MIN_INTERNAL_API_KEY_LENGTH);
const WEAK_KEY = "short";

function ctx(
  key: string | undefined,
  provided: string | undefined
): {
  env: { INTERNAL_API_KEY?: string };
  req: { header(name: string): string | undefined };
} {
  return {
    env: { INTERNAL_API_KEY: key },
    req: {
      header(name: string): string | undefined {
        return name.toLowerCase() === "x-internal-api-key" ? provided : undefined;
      },
    },
  };
}

describe("isInternetFacingHostname", () => {
  it("flags production and workers.dev hosts", () => {
    expect(isInternetFacingHostname("api.seal.nyc")).toBe(true);
    expect(isInternetFacingHostname("seal-api.account.workers.dev")).toBe(true);
  });

  it("allows local and service-binding hosts", () => {
    expect(isInternetFacingHostname("localhost")).toBe(false);
    expect(isInternetFacingHostname("127.0.0.1")).toBe(false);
    expect(isInternetFacingHostname("internal")).toBe(false);
  });
});

describe("verifyInternalApiKey", () => {
  it("rejects missing, weak, or mismatched keys", () => {
    expect(verifyInternalApiKey(ctx(undefined, STRONG_KEY))).toBe(false);
    expect(verifyInternalApiKey(ctx(WEAK_KEY, WEAK_KEY))).toBe(false);
    expect(verifyInternalApiKey(ctx(STRONG_KEY, undefined))).toBe(false);
    expect(verifyInternalApiKey(ctx(STRONG_KEY, "b".repeat(32)))).toBe(false);
  });

  it("accepts a matching strong key", () => {
    expect(verifyInternalApiKey(ctx(STRONG_KEY, STRONG_KEY))).toBe(true);
  });
});

describe("authorizeInternalRequest", () => {
  it("404s on internet-facing hosts even with a valid key", () => {
    const decision = authorizeInternalRequest(
      ctx(STRONG_KEY, STRONG_KEY),
      "https://api.seal.nyc/internal/send-email"
    );
    expect(decision).toEqual({
      ok: false,
      status: 404,
      error: "not found",
    });
  });

  it("401s on non-public hosts without a valid key", () => {
    const decision = authorizeInternalRequest(
      ctx(STRONG_KEY, undefined),
      "http://internal/send-email"
    );
    expect(decision).toEqual({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
  });

  it("allows binding/local hosts with a valid key", () => {
    expect(
      authorizeInternalRequest(
        ctx(STRONG_KEY, STRONG_KEY),
        "http://internal/send-email"
      )
    ).toEqual({ ok: true });
    expect(
      authorizeInternalRequest(
        ctx(STRONG_KEY, STRONG_KEY),
        "http://localhost:8787/internal/send-email"
      )
    ).toEqual({ ok: true });
  });
});
