import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRIVACY_NOTICE_TEXT,
  hashPrivacyNoticeText,
  PRIVACY_NOTICE_VERSION,
  readOrgPrivacyNoticeText,
  resolvePrivacyNoticeText,
} from "./privacy-notice.js";

describe("privacy notice (SEA-52)", () => {
  it("resolves default when custom is empty", () => {
    expect(resolvePrivacyNoticeText(null)).toBe(DEFAULT_PRIVACY_NOTICE_TEXT);
    expect(resolvePrivacyNoticeText("  ")).toBe(DEFAULT_PRIVACY_NOTICE_TEXT);
    expect(resolvePrivacyNoticeText("Custom notice")).toBe("Custom notice");
  });

  it("hashes deterministically", async () => {
    const a = await hashPrivacyNoticeText("hello");
    const b = await hashPrivacyNoticeText("hello");
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });

  it("reads org signingSettings.privacyNoticeText", () => {
    expect(
      readOrgPrivacyNoticeText(
        JSON.stringify({
          signingSettings: { privacyNoticeText: "Org privacy" },
        })
      )
    ).toBe("Org privacy");
    expect(readOrgPrivacyNoticeText(null)).toBeNull();
    expect(PRIVACY_NOTICE_VERSION).toBe("seal-privacy-1");
  });
});
