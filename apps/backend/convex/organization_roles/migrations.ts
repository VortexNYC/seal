/**
 * Migration scripts for organization roles
 * These are one-time scripts to seed existing organizations
 */

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { ensureVortexAuthSystemRoles } from "../lib/vortexAuthOrganizations";

/**
 * Seed system roles for all existing organizations
 * This is a one-time migration to add roles to organizations created before the role system
 *
 * Usage: Call this via the Convex dashboard or CLI:
 * npx convex run organization_roles/migrations:seedAllOrganizations
 */
export const seedAllOrganizations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const organizations: Doc<"organizations">[] = [];

    for await (const org of ctx.db
      .query("organizations")
      .withIndex("by_active", (q) => q.eq("isActive", true))) {
      organizations.push(org);
    }
    for await (const org of ctx.db
      .query("organizations")
      .withIndex("by_active", (q) => q.eq("isActive", false))) {
      organizations.push(org);
    }

    let seededCount = 0;

    for (const org of organizations) {
      await ensureVortexAuthSystemRoles(ctx, org._id);
      seededCount++;
      console.info(
        `Seeded component roles for organization: ${org.name} (${org._id})`
      );
    }

    return {
      success: true,
      totalOrganizations: organizations.length,
      seeded: seededCount,
      skipped: 0,
    };
  },
});

/**
 * Seed system roles for a specific organization
 * Useful for fixing individual organizations
 *
 * Usage: Call this via the Convex dashboard or CLI:
 * npx convex run organization_roles/migrations:seedOrganization '{"organizationId": "..."}'
 */
export const seedOrganization = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get("organizations", args.organizationId);

    if (!org) {
      throw new Error(`Organization not found: ${args.organizationId}`);
    }

    await ensureVortexAuthSystemRoles(ctx, args.organizationId);

    return {
      success: true,
      message: `Successfully seeded component roles for organization: ${org.name}`,
    };
  },
});
