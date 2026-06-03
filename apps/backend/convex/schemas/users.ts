import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const userStatus = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("suspended"),
  v.literal("pending"),
  v.literal("blocked"),
);
export type UserStatus = Infer<typeof userStatus>;

export const usersTable = defineTable({
  // Kept REQUIRED during the migration so the dozens of existing
  // clerkId-keyed call sites stay green. Better-Auth-provisioned users
  // (which have no Clerk id) store their Better-Auth subject here as a
  // transitional value. The whole column is dropped in P7.
  clerkId: v.string(),

  // vortex-auth component opaque userId (NOT the raw JWT subject).
  vortexAuthUserId: v.optional(v.string()),

  name: v.optional(v.string()),
  email: v.string(),
  avatar: v.optional(v.string()),

  isEmailVerified: v.boolean(),
  lastLoginAt: v.optional(v.number()),

  activeOrganizationId: v.optional(v.id("organizations")),
  // Canonical active-org pointer (component org id string) used by the
  // vortex-auth glue. Replaces activeOrganizationId post-migration.
  activeVortexAuthOrganizationId: v.optional(v.string()),
  timezone: v.string(), // User's timezone
  locale: v.string(), // User's locale (en-US, pt-BR, etc.)

  // Super admin flag (bypasses all organization permissions)
  isSuperAdmin: v.optional(v.boolean()),

  // Legacy field — Stripe customer ID was moved to organizations table.
  // TODO: Remove after migration clears this from existing user documents.
  stripeCustomerId: v.optional(v.string()),

  // Onboarding tracking
  onboardingCompleted: v.optional(v.boolean()),
  onboardingCompletedAt: v.optional(v.number()),

  updatedAt: v.optional(v.number()),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_email", ["email"])
  .index("by_active_org", ["activeOrganizationId"])
  .index("by_vortex_auth_user", ["vortexAuthUserId"]);
