/**
 * Helper functions for organization roles
 */

import type { Id } from "../_generated/dataModel";

/**
 * Seed system roles for a new organization
 * Creates default roles (Admin, Member, Viewer) with permissions from templates
 * Owner role is NOT seeded - it's assigned directly to members
 */
export async function seedSystemRoles(
  _db: unknown,
  _organizationId: Id<"organizations">,
): Promise<void> {
  // Local organization_roles no longer exists. Role seeding is handled by
  // vortexAuthOrganizations.ensureVortexAuthSystemRoles.
}
