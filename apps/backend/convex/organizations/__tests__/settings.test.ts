import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";

describe("Organization settings", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let adminUserId: Id<"users">;
  let ownerUserId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Settings Test Org",
        slug: "settings-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    adminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@settings-test.com",
        name: "Admin User",
        authSubject: "settings_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@settings-test.com",
        name: "Owner User",
        authSubject: "settings_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Admin membership
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: adminUserId,
        organizationId,
        role: "admin",
        status: "active",
      });
    });

    // Owner membership
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerUserId,
        organizationId,
        role: "owner",
        status: "active",
      });
    });

    // Pro subscription (required for branding features)
    const now = Date.now();
    await t.run(async (ctx) => {
      const productId = await ctx.db.insert("subscription_products", {
        externalProductId: "prod_settings_test",
        name: "Seal Professional",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_settings_test",
        externalProductId: "prod_settings_test",
        subscriptionProductId: productId,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1900,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("subscriptions", {
        organizationId,
        externalCustomerId: "cus_settings_test",
        externalSubscriptionId: "sub_settings_test",
        externalPriceId: "price_settings_test",
        status: "active",
        currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  // =========================================================================
  // Branding settings
  // =========================================================================

  describe("getBrandingSettings", () => {
    test("returns defaults including companyName and companyWebsite", async () => {
      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(false);
      expect(result.companyName).toBeUndefined();
      expect(result.companyWebsite).toBeUndefined();
    });
  });

  describe("updateBrandingSettings", () => {
    test("updates companyName and companyWebsite", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          companyName: "Acme Corp",
          companyWebsite: "https://acme.com",
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.companyName).toBe("Acme Corp");
      expect(result.companyWebsite).toBe("https://acme.com");
    });

    test("preserves companyName on partial update", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          companyName: "Acme Corp",
        });

      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          brandColor: "#ff0000",
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.companyName).toBe("Acme Corp");
      expect(result.brandColor).toBe("#ff0000");
    });
  });

  // =========================================================================
  // Signing settings
  // =========================================================================

  describe("getSigningSettings", () => {
    test("returns defaults when no settings saved", async () => {
      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.defaultAuthMethod).toBe("email");
      expect(result.allowedSignatureTypes).toEqual(["draw", "type", "upload"]);
      expect(result.esignConsentText).toBeUndefined();
      expect(result.defaultDeadlineDays).toBe(30);
    });

    test("returns saved settings", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          signingSettings: {
            defaultAuthMethod: "email",
            allowedSignatureTypes: ["draw", "type"],
            esignConsentText: "I agree to sign electronically.",
            defaultDeadlineDays: 14,
          },
        });
      });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.allowedSignatureTypes).toEqual(["draw", "type"]);
      expect(result.esignConsentText).toBe("I agree to sign electronically.");
      expect(result.defaultDeadlineDays).toBe(14);
    });
  });

  describe("updateSigningSettings", () => {
    test("updates allowed signature types", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateSigningSettings, {
          allowedSignatureTypes: ["draw"],
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.allowedSignatureTypes).toEqual(["draw"]);
      // Other defaults should be preserved
      expect(result.defaultDeadlineDays).toBe(30);
    });

    test("updates deadline days", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateSigningSettings, {
          defaultDeadlineDays: 7,
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.defaultDeadlineDays).toBe(7);
    });

    test("preserves existing settings on partial update", async () => {
      // First: set consent text
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateSigningSettings, {
          esignConsentText: "Custom consent.",
        });

      // Second: only update deadline
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateSigningSettings, {
          defaultDeadlineDays: 60,
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.esignConsentText).toBe("Custom consent.");
      expect(result.defaultDeadlineDays).toBe(60);
    });

    test("rejects deadline < 1", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateSigningSettings, {
            defaultDeadlineDays: 0,
          })
      ).rejects.toThrow("Deadline days must be between 1 and 365");
    });

    test("rejects deadline > 365", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateSigningSettings, {
            defaultDeadlineDays: 366,
          })
      ).rejects.toThrow("Deadline days must be between 1 and 365");
    });

    test("rejects empty signature types array", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateSigningSettings, {
            allowedSignatureTypes: [],
          })
      ).rejects.toThrow("At least one signature type must be allowed");
    });
  });

  // =========================================================================
  // Notification settings
  // =========================================================================

  describe("getNotificationSettings", () => {
    test("returns defaults when no settings saved", async () => {
      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getNotificationSettings, {
          organizationId,
        });

      expect(result.reminderSchedule).toEqual([3, 7, 14]);
      expect(result.expirationAlertDays).toBe(3);
      expect(result.sendCompletionEmail).toBe(true);
      expect(result.sendViewedNotification).toBe(true);
    });

    test("returns saved settings", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          notificationSettings: {
            reminderSchedule: [1, 5],
            expirationAlertDays: 7,
            sendCompletionEmail: false,
            sendViewedNotification: false,
          },
        });
      });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getNotificationSettings, {
          organizationId,
        });

      expect(result.reminderSchedule).toEqual([1, 5]);
      expect(result.expirationAlertDays).toBe(7);
      expect(result.sendCompletionEmail).toBe(false);
      expect(result.sendViewedNotification).toBe(false);
    });
  });

  describe("updateNotificationSettings", () => {
    test("updates reminder schedule", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateNotificationSettings, {
          reminderSchedule: [1, 3, 7],
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getNotificationSettings, {
          organizationId,
        });

      expect(result.reminderSchedule).toEqual([1, 3, 7]);
      // Others unchanged from defaults
      expect(result.sendCompletionEmail).toBe(true);
    });

    test("toggles boolean notifications", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateNotificationSettings, {
          sendCompletionEmail: false,
          sendViewedNotification: false,
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getNotificationSettings, {
          organizationId,
        });

      expect(result.sendCompletionEmail).toBe(false);
      expect(result.sendViewedNotification).toBe(false);
    });

    test("rejects reminder schedule with > 10 entries", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateNotificationSettings, {
            reminderSchedule: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          })
      ).rejects.toThrow("cannot have more than 10 entries");
    });

    test("rejects reminder schedule not in ascending order", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateNotificationSettings, {
            reminderSchedule: [7, 3, 14],
          })
      ).rejects.toThrow("ascending order");
    });

    test("rejects reminder days < 1", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateNotificationSettings, {
            reminderSchedule: [0, 3],
          })
      ).rejects.toThrow("positive integers");
    });

    test("rejects expiration alert days out of range", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateNotificationSettings, {
            expirationAlertDays: 0,
          })
      ).rejects.toThrow("between 1 and 30");

      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateNotificationSettings, {
            expirationAlertDays: 31,
          })
      ).rejects.toThrow("between 1 and 30");
    });
  });

  // =========================================================================
  // Security settings
  // =========================================================================

  describe("getSecuritySettings", () => {
    test("returns defaults when no settings saved", async () => {
      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.ipAllowlist).toBeUndefined();
      expect(result.allowApiAccess).toBe(true);
      expect(result.requireMfa).toBe(false);
      expect(result.sessionTimeoutMinutes).toBeUndefined();
    });

    test("returns saved settings", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          securitySettings: {
            ipAllowlist: ["10.0.0.0/8", "192.168.1.1"],
            allowApiAccess: false,
          },
        });
      });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.ipAllowlist).toEqual(["10.0.0.0/8", "192.168.1.1"]);
      expect(result.allowApiAccess).toBe(false);
    });
  });

  describe("updateSecuritySettings", () => {
    test("owner can update IP allowlist", async () => {
      await t
        .withIdentity({ subject: "settings_owner" })
        .mutation(api.organizations.mutations.updateSecuritySettings, {
          ipAllowlist: ["10.0.0.0/8"],
        });

      const result = await t
        .withIdentity({ subject: "settings_owner" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.ipAllowlist).toEqual(["10.0.0.0/8"]);
    });

    test("owner can disable API access", async () => {
      await t
        .withIdentity({ subject: "settings_owner" })
        .mutation(api.organizations.mutations.updateSecuritySettings, {
          allowApiAccess: false,
        });

      const result = await t
        .withIdentity({ subject: "settings_owner" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.allowApiAccess).toBe(false);
    });

    test("admin (non-owner) cannot update security settings", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.updateSecuritySettings, {
            allowApiAccess: false,
          })
      ).rejects.toThrow("Only organization owners");
    });

    test("rejects invalid CIDR format", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_owner" })
          .mutation(api.organizations.mutations.updateSecuritySettings, {
            ipAllowlist: ["not-a-cidr"],
          })
      ).rejects.toThrow("Invalid CIDR format");
    });

    test("preserves legacy requireMfa when updating API access (SEA-604)", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          securitySettings: {
            allowApiAccess: true,
            requireMfa: true,
            sessionTimeoutMinutes: 60,
          },
        });
      });

      await t
        .withIdentity({ subject: "settings_owner" })
        .mutation(api.organizations.mutations.updateSecuritySettings, {
          allowApiAccess: false,
        });

      const result = await t
        .withIdentity({ subject: "settings_owner" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.requireMfa).toBe(true);
      expect(result.sessionTimeoutMinutes).toBe(60);
      expect(result.allowApiAccess).toBe(false);
    });
  });

  // =========================================================================
  // Unified getOrgSettings
  // =========================================================================

  describe("getOrgSettings", () => {
    test("returns all settings categories with defaults", async () => {
      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getOrgSettings, {
          organizationId,
        });

      // Signing defaults
      expect(result.signing.defaultDeadlineDays).toBe(30);
      expect(result.signing.allowedSignatureTypes).toEqual([
        "draw",
        "type",
        "upload",
      ]);

      // Notification defaults
      expect(result.notifications.reminderSchedule).toEqual([3, 7, 14]);
      expect(result.notifications.sendCompletionEmail).toBe(true);

      // Security defaults
      expect(result.security.allowApiAccess).toBe(true);
      expect(result.security.requireMfa).toBe(false);
      expect(result.security.sessionTimeoutMinutes).toBeUndefined();

      // AI defaults
      expect(result.ai.aiEnabled).toBe(true);

      // Branding defaults
      expect(result.branding.enabled).toBe(false);
      expect(result.branding.companyName).toBeUndefined();
      expect(result.branding.companyWebsite).toBeUndefined();
    });
  });

  // =========================================================================
  // resetOrgSettings
  // =========================================================================

  describe("resetOrgSettings", () => {
    test("resets branding settings to defaults", async () => {
      // Set some branding first
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateBrandingSettings, {
          companyName: "Acme Corp",
          brandColor: "#ff0000",
          enabled: true,
        });

      // Reset
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.resetOrgSettings, {
          category: "branding",
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getBrandingSettings, {
          organizationId,
        });

      expect(result.enabled).toBe(false);
      expect(result.companyName).toBeUndefined();
      expect(result.brandColor).toBeUndefined();
    });

    test("resets signing settings to defaults", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateSigningSettings, {
          defaultDeadlineDays: 7,
        });

      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.resetOrgSettings, {
          category: "signing",
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getSigningSettings, {
          organizationId,
        });

      expect(result.defaultDeadlineDays).toBe(30);
    });

    test("resets notification settings to defaults", async () => {
      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.updateNotificationSettings, {
          sendCompletionEmail: false,
        });

      await t
        .withIdentity({ subject: "settings_admin" })
        .mutation(api.organizations.mutations.resetOrgSettings, {
          category: "notifications",
        });

      const result = await t
        .withIdentity({ subject: "settings_admin" })
        .query(api.organizations.queries.getNotificationSettings, {
          organizationId,
        });

      expect(result.sendCompletionEmail).toBe(true);
    });

    test("owner can reset security settings", async () => {
      await t
        .withIdentity({ subject: "settings_owner" })
        .mutation(api.organizations.mutations.updateSecuritySettings, {
          allowApiAccess: false,
          ipAllowlist: ["10.0.0.0/8"],
        });

      await t
        .withIdentity({ subject: "settings_owner" })
        .mutation(api.organizations.mutations.resetOrgSettings, {
          category: "security",
        });

      const result = await t
        .withIdentity({ subject: "settings_owner" })
        .query(api.organizations.queries.getSecuritySettings, {
          organizationId,
        });

      expect(result.allowApiAccess).toBe(true);
      expect(result.requireMfa).toBe(false);
    });

    test("admin (non-owner) cannot reset security settings", async () => {
      await expect(
        t
          .withIdentity({ subject: "settings_admin" })
          .mutation(api.organizations.mutations.resetOrgSettings, {
            category: "security",
          })
      ).rejects.toThrow("Only organization owners can reset security settings");
    });
  });
});
