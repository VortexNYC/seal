import { describe, expect, test } from "vitest";

import { resolveEffectiveBrandingSettings } from "../suiteOrgPolicy";
import type { Doc } from "../../_generated/dataModel";

describe("resolveEffectiveBrandingSettings", () => {
  test("prefers Core suite brand over mirror colors", () => {
    const org = {
      logo: "https://cdn.example/logo.png",
      brandingSettings: {
        enabled: true,
        brandColor: "#111111",
        accentColor: "#222222",
        emailFromName: "Mirror",
        hideSealBranding: true,
        customFooterText: "Seal footer",
      },
    } as Pick<Doc<"organizations">, "brandingSettings" | "logo">;

    const effective = resolveEffectiveBrandingSettings(org, {
      primaryColor: "#aabbcc",
      accentColor: "#ddeeff",
      emailFromName: "Core From",
      emailReplyTo: "reply@core.test",
      website: "https://core.test",
    });

    expect(effective.brandColor).toBe("#aabbcc");
    expect(effective.accentColor).toBe("#ddeeff");
    expect(effective.emailFromName).toBe("Core From");
    expect(effective.emailReplyTo).toBe("reply@core.test");
    expect(effective.companyWebsite).toBe("https://core.test");
    expect(effective.logoUrl).toBe("https://cdn.example/logo.png");
    expect(effective.hideSealBranding).toBe(true);
    expect(effective.customFooterText).toBe("Seal footer");
    expect(effective.enabled).toBe(true);
  });

  test("enables branding from Core-only identity without local enabled", () => {
    const org = {
      brandingSettings: {
        enabled: false,
        hideSealBranding: false,
      },
    } as Pick<Doc<"organizations">, "brandingSettings" | "logo">;

    const effective = resolveEffectiveBrandingSettings(org, {
      primaryColor: "#00ff00",
    });

    expect(effective.enabled).toBe(true);
    expect(effective.brandColor).toBe("#00ff00");
  });

  test("keeps signing chrome from local when Core brand is absent", () => {
    const org = {
      brandingSettings: {
        enabled: false,
        hideSealBranding: true,
        customFooterText: "Custom",
      },
    } as Pick<Doc<"organizations">, "brandingSettings" | "logo">;

    const effective = resolveEffectiveBrandingSettings(org);

    expect(effective.enabled).toBe(false);
    expect(effective.hideSealBranding).toBe(true);
    expect(effective.customFooterText).toBe("Custom");
  });
});
