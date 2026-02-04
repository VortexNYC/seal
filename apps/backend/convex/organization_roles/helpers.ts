/**
 * Helper functions for organization roles
 */

import type { GenericDatabaseWriter } from "convex/server";

import type { DataModel, Id } from "../_generated/dataModel";
import { ROLE_TEMPLATES, type RoleTemplate } from "../auth/permissions";

/**
 * Seed system roles for a new organization
 * Creates default roles (Admin, Member, Viewer) with permissions from templates
 * Owner role is NOT seeded - it's assigned directly to members
 */
export async function seedSystemRoles(
  db: GenericDatabaseWriter<DataModel>,
  organizationId: Id<"organizations">,
): Promise<void> {
  const now = Date.now();

  // Roles to seed (exclude owner as it's assigned per-member, not stored as a role)
  const rolesToSeed: Array<{
    name: string;
    key: RoleTemplate;
  }> = [
    { name: "Administrator", key: "admin" },
    { name: "Member", key: "member" },
    { name: "Viewer", key: "viewer" },
  ];

  // Create all system roles
  await Promise.all(
    rolesToSeed.map(async (roleConfig) => {
      const template = ROLE_TEMPLATES[roleConfig.key];

      // Check if role already exists (prevent duplicates)
      const existing = await db
        .query("organization_roles")
        .withIndex("by_name", (q) =>
          q.eq("organizationId", organizationId).eq("name", roleConfig.name),
        )
        .first();

      if (!existing) {
        await db.insert("organization_roles", {
          name: roleConfig.name,
          permissions: [...template.permissions],
          organizationId,
          type: "system",
          createdAt: now,
          updatedAt: now,
        });
      }
    }),
  );
}
