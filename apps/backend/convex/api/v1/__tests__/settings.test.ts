import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/settings", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Settings API Test Org",
        slug: "settings-api-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@settings-api.com",
        name: "Admin",
        clerkId: "clerk_settings_api_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // getSettings
  // =========================================================================

  describe("getSettings", () => {
    test("returns default signing settings when org has none saved", async () => {
      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.allowed_signature_types).toEqual(["draw", "type", "upload"]);
      expect(result.signing.default_deadline_days).toBe(30);
      expect(result.signing.esign_consent_text).toBeNull();
    });

    test("returns default notification settings", async () => {
      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.notifications.reminder_schedule).toEqual([3, 7, 14]);
      expect(result.notifications.expiration_alert_days).toBe(3);
      expect(result.notifications.send_completion_email).toBe(true);
      expect(result.notifications.send_viewed_notification).toBe(true);
    });

    test("returns default AI settings", async () => {
      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.ai.enabled).toBe(false);
      expect(result.ai.auto_analyze).toBe(false);
    });

    test("returns default security settings", async () => {
      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.security.ip_allowlist).toEqual([]);
      expect(result.security.allow_api_access).toBe(true);
      expect(result.security.require_mfa).toBe(false);
      expect(result.security.session_timeout_minutes).toBeNull();
    });

    test("returns saved signing settings", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(organizationId, {
          signingSettings: {
            defaultAuthMethod: "email",
            allowedSignatureTypes: ["draw", "type"],
            defaultDeadlineDays: 14,
            esignConsentText: "I agree to sign electronically.",
          },
        });
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.allowed_signature_types).toEqual(["draw", "type"]);
      expect(result.signing.default_deadline_days).toBe(14);
      expect(result.signing.esign_consent_text).toBe("I agree to sign electronically.");
    });

    test("throws when org does not exist", async () => {
      // Insert then delete to get a valid but non-existent ID
      const tempId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("organizations", {
          name: "Temp",
          slug: "temp-delete-settings",
          type: "company",
          isActive: true,
          timezone: "UTC",
          updatedAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.query(internal.api.v1.settings.getSettings, {
          userId,
          organizationId: tempId,
        }),
      ).rejects.toThrow("Organization not found");
    });
  });

  // =========================================================================
  // updateSettings
  // =========================================================================

  describe("updateSettings", () => {
    test("updates signing settings", async () => {
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: {
          allowed_signature_types: ["draw"],
          default_deadline_days: 7,
        },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.allowed_signature_types).toEqual(["draw"]);
      expect(result.signing.default_deadline_days).toBe(7);
      // Esign consent text unchanged (still default)
      expect(result.signing.esign_consent_text).toBeNull();
    });

    test("clears esign consent text when set to null", async () => {
      // First set it
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: { esign_consent_text: "Custom consent" },
      });

      // Then clear it
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: { esign_consent_text: null },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.esign_consent_text).toBeNull();
    });

    test("updates notification settings", async () => {
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        notifications: {
          reminder_schedule: [1, 5],
          send_completion_email: false,
        },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.notifications.reminder_schedule).toEqual([1, 5]);
      expect(result.notifications.send_completion_email).toBe(false);
      // Unchanged defaults preserved
      expect(result.notifications.expiration_alert_days).toBe(3);
      expect(result.notifications.send_viewed_notification).toBe(true);
    });

    test("updates AI settings", async () => {
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        ai: { enabled: true, auto_analyze: true },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.ai.enabled).toBe(true);
      expect(result.ai.auto_analyze).toBe(true);
    });

    test("updates security settings", async () => {
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        security: {
          ip_allowlist: ["10.0.0.0/8"],
          require_mfa: true,
          session_timeout_minutes: 60,
        },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.security.ip_allowlist).toEqual(["10.0.0.0/8"]);
      expect(result.security.require_mfa).toBe(true);
      expect(result.security.session_timeout_minutes).toBe(60);
      expect(result.security.allow_api_access).toBe(true); // default preserved
    });

    test("clears session timeout when set to null", async () => {
      // First set it
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        security: { session_timeout_minutes: 120 },
      });

      // Then clear it
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        security: { session_timeout_minutes: null },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.security.session_timeout_minutes).toBeNull();
    });

    test("can update multiple categories in a single call", async () => {
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: { default_deadline_days: 60 },
        notifications: { send_completion_email: false },
        ai: { enabled: true },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.default_deadline_days).toBe(60);
      expect(result.notifications.send_completion_email).toBe(false);
      expect(result.ai.enabled).toBe(true);
    });

    test("preserves unchanged signing fields on partial update", async () => {
      // Set all signing fields first
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: {
          allowed_signature_types: ["draw"],
          default_deadline_days: 14,
          esign_consent_text: "Custom consent",
        },
      });

      // Only update deadline
      await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        signing: { default_deadline_days: 21 },
      });

      const result = await t.query(internal.api.v1.settings.getSettings, {
        userId,
        organizationId,
      });

      expect(result.signing.default_deadline_days).toBe(21);
      expect(result.signing.allowed_signature_types).toEqual(["draw"]);
      expect(result.signing.esign_consent_text).toBe("Custom consent");
    });

    test("returns success:true on update", async () => {
      const result = await t.mutation(internal.api.v1.settings.updateSettings, {
        userId,
        organizationId,
        ai: { enabled: true },
      });

      expect(result.success).toBe(true);
    });
  });
});
