/**
 * SEA-605 — invite + redeem paths must enforce plan seat limits server-side.
 */
import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createVortexAuthInvitation } from "../lib/vortexAuthOrganizations";
import { createTestContext } from "../test.setup";
import { seedTestOrganizationMember } from "../testVortexAuth";

describe("invitations seat enforcement (SEA-605)", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerUserId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Invite Seat Org",
        slug: "invite-seat-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@invite-seat.test",
        name: "Owner",
        authSubject: "invite_seat_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        organizationId,
        userId: ownerUserId,
        role: "owner",
        status: "active",
      });
    });
  });

  async function seedProSubscription() {
    const now = Date.now();
    await t.run(async (ctx) => {
      const productId = await ctx.db.insert("subscription_products", {
        externalProductId: "prod_invite_seat",
        name: "Seal Pro",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("subscription_prices", {
        externalPriceId: "price_invite_seat",
        externalProductId: "prod_invite_seat",
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
        externalCustomerId: "cus_invite_seat",
        externalSubscriptionId: "sub_invite_seat",
        externalPriceId: "price_invite_seat",
        status: "active",
        currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
        currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  test("free org with owner cannot createInvitation", async () => {
    await expect(
      t
        .withIdentity({ subject: "invite_seat_owner" })
        .mutation(api.invitations.createInvitation, {
          email: "teammate@example.com",
          role: "member",
        })
    ).rejects.toThrow(/seat limit|Upgrade to Professional/i);
  });

  test("pro org can createInvitation when under seat limit", async () => {
    await seedProSubscription();

    const result = await t
      .withIdentity({ subject: "invite_seat_owner" })
      .mutation(api.invitations.createInvitation, {
        email: "teammate@example.com",
        role: "member",
      });

    expect(result.invitationId).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.acceptUrl).toContain("/accept-invite?token=");
  });

  test("redeemInvitation rejects when org is at seat limit", async () => {
    await seedProSubscription();

    // Fill Pro seats (owner already counted → add 19 more = 20).
    for (let i = 0; i < 19; i++) {
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: `member-${i}@invite-seat.test`,
          name: `Member ${i}`,
          authSubject: `invite_seat_member_${i}`,
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });
      });
      await t.run(async (ctx) => {
        await seedTestOrganizationMember(ctx, {
          organizationId,
          userId,
          role: "member",
          status: "active",
        });
      });
    }

    // Create invite while seats are full via direct component write, then redeem.
    const token = "redeem-seat-full-token";
    const tokenHash = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(token))
      .then((digest) =>
        Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")
      );

    await t.run(async (ctx) => {
      await createVortexAuthInvitation(ctx, {
        organizationId,
        email: "late@invite-seat.test",
        tokenHash,
        role: "member",
        status: "pending",
        invitedBy: ownerUserId,
        expiresAt: Date.now() + 86_400_000,
      });
    });

    const inviteeId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "late@invite-seat.test",
        name: "Late Invitee",
        authSubject: "invite_seat_late",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
      });
    });

    await expect(
      t
        .withIdentity({ subject: "invite_seat_late" })
        .mutation(api.invitations.redeemInvitation, { token })
    ).rejects.toThrow(/seat limit/i);

    // invitee should not have been patched as a member path success
    const invitee = await t.run(async (ctx) => ctx.db.get(inviteeId));
    expect(invitee?.activeOrganizationId).toBeUndefined();
  });
});
