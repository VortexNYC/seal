import { dark as clerkDark } from "@clerk/themes";
import { dark as darkTokens, light, status } from "@seal/tokens/theme";
import { describe, expect, test } from "vitest";

import { getClerkAuthAppearance } from "./clerk-auth-theme";

describe("getClerkAuthAppearance", () => {
  test("returns light mode appearance with preserved logo sizing", () => {
    const appearance = getClerkAuthAppearance(false);

    expect(appearance.theme).toBeUndefined();
    expect(appearance.layout?.socialButtonsVariant).toBe("blockButton");
    expect(appearance.variables?.colorPrimary).toBe(light.primary);
    expect(appearance.variables?.colorBackground).toBe(light.card);
    expect(appearance.variables?.colorDanger).toBe(status.destructive);
    expect(appearance.elements).toMatchObject({
      logoBox: {
        height: "80px",
        marginBottom: "16px",
      },
      logoImage: {
        height: "80px",
        width: "auto",
      },
    });
  });

  test("returns dark mode appearance with Clerk dark theme and token colors", () => {
    const appearance = getClerkAuthAppearance(true);

    expect(appearance.theme).toBe(clerkDark);
    expect(appearance.variables?.colorPrimary).toBe(darkTokens.primary);
    expect(appearance.variables?.colorBackground).toBe(darkTokens.card);
    expect(appearance.variables?.colorInput).toBe(darkTokens.surface);
    expect(appearance.variables?.colorBorder).toBe(darkTokens.border);
    expect(appearance.variables?.colorRing).toBe(darkTokens.ring);
    expect(appearance.variables?.colorModalBackdrop).toBe("rgba(10, 10, 10, 0.78)");
  });

  test("includes the embedded auth element overrides used by auth routes", () => {
    const appearance = getClerkAuthAppearance(false);

    expect(appearance.elements).toMatchObject({
      rootBox: { width: "100%" },
      cardBox: { width: "100%" },
      formFieldInput: {
        backgroundColor: light.surface,
        border: `1px solid ${light.border}`,
        borderRadius: "0.75rem",
        color: light.foreground,
      },
      formButtonPrimary: {
        backgroundColor: light.primary,
        color: light.primaryForeground,
        fontWeight: "600",
      },
      footerActionLink: {
        color: light.primary,
        fontWeight: "600",
      },
    });
  });
});
