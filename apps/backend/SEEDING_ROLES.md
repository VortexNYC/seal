# Seeding Organization Roles

This document explains how to seed system roles for organizations in the Seal backend.

## Automatic Seeding (New Organizations)

All **new organizations** created through the following mutations will automatically have system roles seeded:

- `organizations/mutations:ensurePersonalOrganization` - Personal workspaces
- `organizations/mutations:createWorkspace` - Team workspaces

The three system roles that are automatically created:

1. **Administrator** - Full management access except billing
2. **Member** - Can create and edit content
3. **Viewer** - Read-only access

Note: The **Owner** role is not seeded as a separate role record. It's assigned directly to members via the `organization_members.role` field.

## Manual Seeding (Existing Organizations)

For organizations that existed **before** the role system was implemented, you need to run a migration script.

### Seed All Organizations

To seed roles for all existing organizations that don't have roles yet:

```bash
npx convex run organization_roles/migrations:seedAllOrganizations
```

This will:

- Check all organizations in the database
- Skip organizations that already have roles
- Seed the 3 system roles for organizations without roles
- Return a summary of how many were seeded vs skipped

Example output:

```json
{
  "success": true,
  "totalOrganizations": 15,
  "seeded": 12,
  "skipped": 3
}
```

### Seed a Specific Organization

To seed roles for a specific organization:

```bash
npx convex run organization_roles/migrations:seedOrganization '{"organizationId": "jx7abc123def456"}'
```

Replace `jx7abc123def456` with your organization ID.

This will:

- Check if the organization exists
- Check if it already has roles
- Seed the 3 system roles if none exist
- Return success/failure message

Example output (success):

```json
{
  "success": true,
  "message": "Successfully seeded roles for organization: Acme Corp"
}
```

Example output (already has roles):

```json
{
  "success": false,
  "message": "Organization already has 3 roles",
  "existingRoles": [
    { "id": "abc123", "name": "Administrator", "type": "system" },
    { "id": "def456", "name": "Member", "type": "system" },
    { "id": "ghi789", "name": "Viewer", "type": "system" }
  ]
}
```

## Verification

To verify roles were seeded correctly, you can:

1. **Via Convex Dashboard:**
   - Go to the Data tab
   - Select the `organization_roles` table
   - Filter by `organizationId` to see roles for a specific organization

2. **Via Query:**
   ```bash
   npx convex run organization_roles/queries:list --org-id "jx7abc123def456"
   ```

Each organization should have 3 system roles:

- Administrator
- Member
- Viewer

## Troubleshooting

### "Organization already has roles"

This is expected and means the organization was already seeded. The migration scripts are idempotent and won't create duplicate roles.

### "Organization not found"

Double-check the organization ID. You can find IDs in the Convex dashboard under the `organizations` table.

### Roles Missing After Seeding

If roles are still missing after running the migration:

1. Check the Convex dashboard logs for any errors
2. Verify the organization status is not "deleted"
3. Try running the specific organization seed command with that org ID

## Implementation Details

**Location:** `apps/backend/convex/organization_roles/`

**Files:**

- `helpers.ts` - Contains `seedSystemRoles()` function
- `migrations.ts` - Contains migration scripts for existing orgs
- `mutations.ts` - CRUD operations for custom roles
- `queries.ts` - Queries to list and retrieve roles

**Role Templates:** Defined in `apps/backend/convex/auth/permissions.ts`
