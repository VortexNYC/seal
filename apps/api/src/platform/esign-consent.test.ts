import { describe, expect, it } from "vitest";

import {
  DEFAULT_ESIGN_CONSENT_TEXT,
  ESIGN_CONSENT_VERSION,
  hashEsignConsentText,
  readOrgEsignConsentText,
  resolveEsignConsentText,
} from "./esign-consent.js";

describe("esign-consent", () => {
  it("resolves custom org text over default", () => {
    expect(resolveEsignConsentText(null)).toBe(DEFAULT_ESIGN_CONSENT_TEXT);
    expect(resolveEsignConsentText("  Custom terms.  ")).toBe("Custom terms.");
  });

  it("hashes consent text stably", async () => {
    const a = await hashEsignConsentText(DEFAULT_ESIGN_CONSENT_TEXT);
    const b = await hashEsignConsentText(DEFAULT_ESIGN_CONSENT_TEXT);
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
    expect(a.length).toBe("sha256:".length + 64);
  });

  it("reads org signingSettings.esignConsentText", () => {
    expect(
      readOrgEsignConsentText(
        JSON.stringify({
          signingSettings: { esignConsentText: "Org-specific consent" },
        })
      )
    ).toBe("Org-specific consent");
    expect(readOrgEsignConsentText("{not-json")).toBeNull();
    expect(ESIGN_CONSENT_VERSION).toMatch(/^seal-esign-/);
  });
});
