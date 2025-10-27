/**
 * Migration scripts for organization roles
 * These are one-time scripts to seed existing organizations
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { seedSystemRoles } from "./helpers";

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
		const organizations = await ctx.db.query("organizations").collect();

		let seededCount = 0;
		let skippedCount = 0;

		for (const org of organizations) {
			// Check if organization already has roles
			const existingRoles = await ctx.db
				.query("organization_roles")
				.withIndex("by_organization", (q) => q.eq("organizationId", org._id))
				.collect();

			if (existingRoles.length === 0) {
				// Seed roles for this organization
				await seedSystemRoles(ctx.db, org._id);
				seededCount++;
				console.log(`Seeded roles for organization: ${org.name} (${org._id})`);
			} else {
				skippedCount++;
				console.log(
					`Skipped organization: ${org.name} (${org._id}) - already has ${existingRoles.length} roles`,
				);
			}
		}

		return {
			success: true,
			totalOrganizations: organizations.length,
			seeded: seededCount,
			skipped: skippedCount,
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
		const org = await ctx.db.get(args.organizationId);

		if (!org) {
			throw new Error(`Organization not found: ${args.organizationId}`);
		}

		// Check if organization already has roles
		const existingRoles = await ctx.db
			.query("organization_roles")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", args.organizationId),
			)
			.collect();

		if (existingRoles.length > 0) {
			return {
				success: false,
				message: `Organization already has ${existingRoles.length} roles`,
				existingRoles: existingRoles.map((r) => ({
					id: r._id,
					name: r.name,
					type: r.type,
				})),
			};
		}

		// Seed roles for this organization
		await seedSystemRoles(ctx.db, args.organizationId);

		return {
			success: true,
			message: `Successfully seeded roles for organization: ${org.name}`,
		};
	},
});
