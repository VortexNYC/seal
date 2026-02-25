import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Branding settings", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let adminUserId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Branding Test Org",
        slug: "branding-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    adminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@branding-test.com",
        name: "Admin User",
        clerkId: "clerk_branding_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Admin membership (admin role gives branding:manage permission)
    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: adminUserId,
        organizationId,
        role: "admin",
        status: "active",
        isPrimary: true,
      });
    });
  });

  describe("getBrandingSettings", () => {
    test("returns defaults when no branding has been set", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(false);
      expect(result.hideSealBranding).toBe(false);
      expect(result.logoUrl).toBeUndefined();
      expect(result.brandColor).toBeUndefined();
      expect(result.accentColor).toBeUndefined();
      expect(result.emailFromName).toBeUndefined();
      expect(result.emailReplyTo).toBeUndefined();
      expect(result.customFooterText).toBeUndefined();
    });

    test("returns saved branding settings", async () => {
      // Directly set branding on the org
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          brandingSettings: {
            enabled: true,
            brandColor: "#FF0000",
            accentColor: "#00FF00",
            emailFromName: "ACME Corp",
            emailReplyTo: "support@acme.com",
            hideSealBranding: true,
            customFooterText: "Powered by ACME",
          },
        });
      });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(true);
      expect(result.brandColor).toBe("#FF0000");
      expect(result.accentColor).toBe("#00FF00");
      expect(result.emailFromName).toBe("ACME Corp");
      expect(result.emailReplyTo).toBe("support@acme.com");
      expect(result.hideSealBranding).toBe(true);
      expect(result.customFooterText).toBe("Powered by ACME");
    });
  });

  describe("updateBrandingSettings", () => {
    test("enables branding and sets colors", async () => {
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          enabled: true,
          brandColor: "#123456",
          accentColor: "#654321",
        });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(true);
      expect(result.brandColor).toBe("#123456");
      expect(result.accentColor).toBe("#654321");
    });

    test("preserves existing settings when updating partial fields", async () => {
      // First update: set brand color and email name
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          enabled: true,
          brandColor: "#AABBCC",
          emailFromName: "My Company",
        });

      // Second update: only change accent color
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          accentColor: "#DDEEFF",
        });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      // Previous values should be preserved
      expect(result.brandColor).toBe("#AABBCC");
      expect(result.emailFromName).toBe("My Company");
      // New value should be set
      expect(result.accentColor).toBe("#DDEEFF");
      // Enabled should still be true
      expect(result.enabled).toBe(true);
    });

    test("sets email configuration", async () => {
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          emailFromName: "Seal Legal",
          emailReplyTo: "legal@seal.nyc",
          customFooterText: "This is a legal document.",
        });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.emailFromName).toBe("Seal Legal");
      expect(result.emailReplyTo).toBe("legal@seal.nyc");
      expect(result.customFooterText).toBe("This is a legal document.");
    });

    test("can hide Seal branding", async () => {
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          hideSealBranding: true,
        });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.hideSealBranding).toBe(true);
    });

    test("can disable branding", async () => {
      // Enable first
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          enabled: true,
          brandColor: "#FF0000",
        });

      // Then disable
      await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          enabled: false,
        });

      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(false);
      // Colors should still be preserved
      expect(result.brandColor).toBe("#FF0000");
    });

    test("returns success object", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_branding_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          enabled: true,
        });

      expect(result).toEqual({ success: true });
    });
  });
});
