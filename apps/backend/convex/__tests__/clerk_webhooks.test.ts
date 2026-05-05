import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import { createTestContext } from "../test.setup";

/**
 * Integration tests for the Clerk webhook → Convex sync mutations.
 *
 * The HTTP route at /clerk-webhooks (apps/backend/convex/http.ts:485) verifies
 * the Svix signature, parses the event, and dispatches into one of the
 * mutations exercised here. The signature-verification + dispatch layer is
 * covered by the Clerk + Svix SDKs themselves; what's specific to Seal is
 * the state these mutations write on each event, which is what these tests
 * pin down.
 *
 * If a future change accidentally breaks user/org sync (e.g., refactor that
 * stops indexing users by clerkId), these tests fail before the change ever
 * reaches a deployed environment.
 */

describe("Clerk webhook sync mutations", () => {
  let t: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    t = createTestContext();
  });

  describe("syncUser", () => {
    test("creates a new user record on first sync", async () => {
      const result = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_new_001",
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatar: "https://example.com/ada.png",
        isEmailVerified: true,
      });

      expect(result.isNewUser).toBe(true);
      expect(result.userId).toBeDefined();

      const stored = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "user_test_new_001"))
          .first();
      });

      expect(stored).not.toBeNull();
      expect(stored?.email).toBe("ada@example.com");
      expect(stored?.name).toBe("Ada Lovelace");
      expect(stored?.isEmailVerified).toBe(true);
    });

    test("updates the existing user on a second sync (idempotent)", async () => {
      const first = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_idempotent_001",
        name: "Original Name",
        email: "first@example.com",
        isEmailVerified: false,
      });
      expect(first.isNewUser).toBe(true);

      const second = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_idempotent_001",
        name: "Updated Name",
        email: "updated@example.com",
        isEmailVerified: true,
      });
      expect(second.isNewUser).toBe(false);
      expect(second.userId).toBe(first.userId);

      const stored = await t.run((ctx) => ctx.db.get(first.userId));
      expect(stored?.name).toBe("Updated Name");
      expect(stored?.email).toBe("updated@example.com");
      expect(stored?.isEmailVerified).toBe(true);
    });

    test("uses sane defaults for optional fields", async () => {
      const { userId } = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_defaults_001",
        email: "defaults@example.com",
        isEmailVerified: false,
      });

      const stored = await t.run((ctx) => ctx.db.get(userId));
      expect(stored?.timezone).toBe("UTC");
      expect(stored?.locale).toBe("en-US");
    });
  });

  describe("deleteUser", () => {
    test("removes a synced user and all of their memberships", async () => {
      const { userId } = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_delete_001",
        email: "delete@example.com",
        isEmailVerified: true,
      });

      const { organizationId } = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_delete_001",
        name: "Delete Me Inc",
      });

      // Seed a membership directly so we can assert it's cascaded.
      const membershipId = await t.run((ctx) =>
        ctx.db.insert("organization_members", {
          organizationId,
          userId,
          role: "admin",
          status: "active",
          isPrimary: true,
        }),
      );

      const result = await t.mutation(api.clerk_webhooks.deleteUser, {
        clerkId: "user_test_delete_001",
      });
      expect(result.success).toBe(true);

      const userAfter = await t.run((ctx) => ctx.db.get(userId));
      expect(userAfter).toBeNull();

      const membershipAfter = await t.run((ctx) => ctx.db.get(membershipId));
      expect(membershipAfter).toBeNull();
    });

    test("returns success when the user was never synced (idempotent)", async () => {
      const result = await t.mutation(api.clerk_webhooks.deleteUser, {
        clerkId: "user_test_never_existed",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("syncOrganization", () => {
    test("creates a new organization with the Clerk-supplied slug", async () => {
      const { organizationId } = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_create_001",
        name: "Acme Co",
        slug: "acme-co",
      });

      const stored = await t.run((ctx) => ctx.db.get(organizationId));
      expect(stored?.name).toBe("Acme Co");
      expect(stored?.slug).toBe("acme-co");
      expect(stored?.clerkId).toBe("org_test_create_001");
      expect(stored?.isActive).toBe(true);
    });

    test("derives a slug from the name when Clerk doesn't provide one", async () => {
      const { organizationId } = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_slug_001",
        name: "Slug Me Please",
      });

      const stored = await t.run((ctx) => ctx.db.get(organizationId));
      expect(stored?.slug).toBe("slug-me-please");
    });

    test("is idempotent on Clerk ID — second call updates the same row", async () => {
      const first = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_idempotent_001",
        name: "Original Name",
      });
      const second = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_idempotent_001",
        name: "Renamed Inc",
      });
      expect(second.organizationId).toBe(first.organizationId);

      const stored = await t.run((ctx) => ctx.db.get(first.organizationId));
      expect(stored?.name).toBe("Renamed Inc");
    });
  });

  describe("syncOrganizationMembership", () => {
    test("creates a membership row tying user and org with the Clerk role", async () => {
      const { userId } = await t.mutation(api.clerk_webhooks.syncUser, {
        clerkId: "user_test_membership_001",
        email: "member@example.com",
        isEmailVerified: true,
      });
      const { organizationId } = await t.mutation(api.clerk_webhooks.syncOrganization, {
        clerkId: "org_test_membership_001",
        name: "Member Org",
      });

      await t.mutation(api.clerk_webhooks.syncOrganizationMembership, {
        userClerkId: "user_test_membership_001",
        organizationClerkId: "org_test_membership_001",
        role: "admin",
      });

      const membership = await t.run(async (ctx) => {
        return ctx.db
          .query("organization_members")
          .withIndex("by_user_organization", (q) =>
            q.eq("userId", userId).eq("organizationId", organizationId),
          )
          .first();
      });

      expect(membership).not.toBeNull();
      // Clerk's `admin` role translates to Seal's `owner` for the first
      // organization membership the user joins. The mapping itself lives in
      // syncOrganizationMembership; this assertion pins it down.
      expect(membership?.role).toBe("owner");
      expect(membership?.organizationId).toBe(organizationId);
      expect(membership?.userId).toBe(userId);
      expect(membership?.status).toBe("active");
    });
  });
});
