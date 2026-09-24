import { describe, expect, it } from "vitest";

import {
  hashAccessCode,
  isSignerAuthVerified,
  markAccessCodeVerified,
  normalizeAuthMethod,
  parseSignerAuthState,
  serializeSignerAuthState,
  startEmailOtpChallenge,
  verifyAccessCode,
  verifyEmailOtpChallenge,
} from "./signer-auth.js";

describe("signer-auth", () => {
  it("treats none as always verified", () => {
    expect(isSignerAuthVerified("none", null)).toBe(true);
    expect(normalizeAuthMethod("bogus")).toBe("none");
  });

  it("verifies access codes case-insensitively", async () => {
    const hash = await hashAccessCode("Secret-42");
    expect(await verifyAccessCode("secret-42", hash)).toBe(true);
    expect(await verifyAccessCode("wrong", hash)).toBe(false);
    const state = markAccessCodeVerified();
    expect(
      isSignerAuthVerified("access_code", serializeSignerAuthState(state))
    ).toBe(true);
  });

  it("rounds email OTP challenge through verify", async () => {
    const { code, state } = await startEmailOtpChallenge({});
    const ok = await verifyEmailOtpChallenge(state, code);
    expect(ok.ok).toBe(true);
    if (!ok.ok) {
      return;
    }
    expect(
      isSignerAuthVerified("email_otp", serializeSignerAuthState(ok.state))
    ).toBe(true);
  });

  it("locks after too many bad OTP attempts", async () => {
    const { state } = await startEmailOtpChallenge({});
    let current = state;
    for (let i = 0; i < 5; i++) {
      const result = await verifyEmailOtpChallenge(current, "000000");
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      current = result.state;
    }
    const locked = await verifyEmailOtpChallenge(current, "000000");
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.reason).toBe("locked");
    }
  });

  it("parses unknown auth JSON safely", () => {
    expect(parseSignerAuthState("{not-json")).toEqual({});
    expect(parseSignerAuthState('{"verifiedAt":1}')).toEqual({
      verifiedAt: 1,
    });
  });
});
