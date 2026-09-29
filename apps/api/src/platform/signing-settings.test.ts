import { describe, expect, it } from "vitest";

import {
  readOrgSigningCompliance,
  resolveRecipientAuthMethod,
} from "./signing-settings.js";

describe("readOrgSigningCompliance", () => {
  it("defaults to require auth + account when metadata missing", () => {
    expect(readOrgSigningCompliance(null)).toEqual({
      requireRecipientAuth: true,
      requireSignerAccount: true,
      defaultRecipientAuthMethod: "email_otp",
    });
  });

  it("reads explicit opt-outs", () => {
    expect(
      readOrgSigningCompliance(
        JSON.stringify({
          signingSettings: {
            requireRecipientAuth: false,
            requireSignerAccount: false,
            defaultRecipientAuthMethod: "access_code",
          },
        })
      )
    ).toEqual({
      requireRecipientAuth: false,
      requireSignerAccount: false,
      defaultRecipientAuthMethod: "access_code",
    });
  });
});

describe("resolveRecipientAuthMethod", () => {
  it("preserves explicit none", () => {
    expect(resolveRecipientAuthMethod("none")).toBe("none");
  });

  it("defaults omitted method to email_otp", () => {
    expect(resolveRecipientAuthMethod(undefined)).toBe("email_otp");
  });
});
