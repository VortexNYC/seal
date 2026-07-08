import { describe, expect, test } from "vitest";

import { api, components, internal } from "../../_generated/api";
import { createTestContext } from "../../test.setup";

describe("account creation", () => {
  test("creates a personal organization anchored in Vortex Auth without Stripe records", async () => {
    const t = createTestContext();
    const authSubject = "account_creation_owner";

    await t.run(async (ctx) => {
      await ctx.runMutation(internal.users.upsertFromBetterAuth, {
        betterAuthUserId: authSubject,
        email: "account-creation-owner@example.com",
        emailVerified: true,
        issuer: "seal-test-vortex-auth",
        name: "Account Creation Owner",
      });
    });

    const result = await t.withIdentity({ subject: authSubject }).mutation(
      api.organizations.mutations.ensurePersonalOrganization,
      {
        organizationName: "Account Creation Owner Workspace",
        organizationSlug: "account-creation-owner-workspace",
      },
    );

    const proof = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("by_auth_subject", (q) => q.eq("authSubject", authSubject))
        .first();
      const organization = await ctx.db.get(result.organizationId);
      if (!user) {
        throw new Error("Expected provisioned user");
      }
      if (!organization) {
        throw new Error("Expected created organization");
      }
      if (!user.vortexAuthUserId) {
        throw new Error("Expected user to be bridged to Vortex Auth");
      }
      if (!organization.vortexAuthOrganizationId) {
        throw new Error("Expected organization to be anchored to Vortex Auth");
      }

      const memberships = await ctx.runQuery(
        components.vortexAuth.organizations.listMembershipsByUser,
        {
          userId: user.vortexAuthUserId,
          status: "active",
        },
      );
      const roles = await ctx.runQuery(
        components.vortexAuth.organizations.listRolesByOrganization,
        {
          organizationId: organization.vortexAuthOrganizationId,
        },
      );

      return {
        user,
        organization,
        memberships,
        roles,
        subscriptionCount: (await ctx.db.query("subscriptions").collect()).length,
        subscriptionProductCount: (await ctx.db.query("subscription_products").collect()).length,
        subscriptionPriceCount: (await ctx.db.query("subscription_prices").collect()).length,
        stripeAccountCount: (await ctx.db.query("stripe_accounts").collect()).length,
        stripeWebhookEventCount: (await ctx.db.query("stripe_webhook_events").collect()).length,
      };
    });

    expect(proof.organization.name).toBe("Account Creation Owner Workspace");
    expect(proof.organization.slug).toBe("account-creation-owner-workspace");
    expect(proof.organization.type).toBe("personal");
    expect(proof.user.activeOrganizationId).toBe(result.organizationId);

    const ownerMembership = proof.memberships.find(
      (membership) => membership.organizationId === proof.organization.vortexAuthOrganizationId,
    );
    expect(ownerMembership?.userId).toBe(proof.user.vortexAuthUserId);
    expect(ownerMembership?.status).toBe("active");

    const ownerRole = proof.roles.find((role) => role.key === "owner");
    expect(ownerRole?._id).toBe(ownerMembership?.roleId);

    expect(proof.subscriptionCount).toBe(0);
    expect(proof.subscriptionProductCount).toBe(0);
    expect(proof.subscriptionPriceCount).toBe(0);
    expect(proof.stripeAccountCount).toBe(0);
    expect(proof.stripeWebhookEventCount).toBe(0);
  });
});
