# Seal Invitation System - Complete Documentation

## Quick Navigation

This folder contains comprehensive documentation of the Seal project's invitation system. Choose the guide that matches your needs:

### Start Here
- **[EXPLORATION_COMPLETE.txt](./EXPLORATION_COMPLETE.txt)** - Executive summary of findings

### Primary Guides

1. **[INVITATION_SYSTEM_ANALYSIS.md](./INVITATION_SYSTEM_ANALYSIS.md)** - Complete technical analysis
   - Component inventory (frontend)
   - Mutation & query documentation (backend)
   - Database schema details
   - What's implemented vs. missing
   - Code flow examples

2. **[INVITATION_ARCHITECTURE.md](./INVITATION_ARCHITECTURE.md)** - Visual architecture guide
   - System architecture diagram
   - Workflow diagrams with decision trees
   - Permission flow visualization
   - Data relationship examples
   - Integration points

3. **[INVITATION_FILES_REFERENCE.md](./INVITATION_FILES_REFERENCE.md)** - Quick lookup reference
   - Complete file listing
   - File dependencies map
   - Critical code sections with line numbers
   - Database query patterns
   - API type definitions
   - Testing guide

## Project Status

### Fully Implemented
- Create invitations via dialog
- List pending invitations
- Cancel pending invitations
- Add existing users directly
- Role-based access control
- Member management (suspend, reactivate, remove)
- Permission system integration
- 7-day expiration tracking

### Not Implemented
- Email sending
- Invitation acceptance endpoint
- Invitation acceptance UI
- Status transitions (pending → accepted)
- Automatic expiration cleanup

## Key Files Location

### Frontend
```
apps/web/src/
├── routes/_authenticated/$slug/settings/team/
│   ├── index.tsx (MAIN TEAM PAGE)
│   └── team.tsx (layout wrapper)
└── components/team/
    ├── invite-member-dialog.tsx
    ├── pending-invitations-list.tsx
    ├── members-list.tsx
    └── manage-member-dialog.tsx
```

### Backend
```
apps/backend/convex/
├── organizations/
│   ├── mutations.ts (ALL INVITATION MUTATIONS)
│   └── queries.ts (ALL INVITATION QUERIES)
├── schemas/
│   ├── organization_invitations.ts (DATABASE SCHEMA)
│   ├── organization_members.ts
│   └── organizations.ts
├── auth.ts (PERMISSION WRAPPERS)
├── auth.utils.ts (PERMISSION DEFINITIONS)
└── schema.ts (MAIN SCHEMA)
```

## Code Example: Creating an Invitation

```typescript
// Frontend Component
const createInvitation = useMutation(api.organizations.mutations.createInvitation);

const handleSubmit = async (e) => {
  const result = await createInvitation({
    email: "user@example.com",
    role: "member"
  });
  
  if (result.addedDirectly) {
    // User already existed, added directly to organization
  } else {
    // New invitation created, token stored
  }
}

// Backend Mutation
export const createInvitation = adminMutation({
  args: { email: v.string(), role: v.union(...) },
  handler: async (ctx, args) => {
    // 1. Validate email
    // 2. Check if user exists
    //    - If yes: Add directly to organization_members
    //    - If no: Create invitation record
    // 3. Generate UUID token
    // 4. Set 7-day expiration
    // 5. Return id + addedDirectly flag
  }
})
```

## Data Model

```typescript
organization_invitations {
  _id: ID<"organization_invitations">
  organizationId: ID<"organizations">
  email: string
  role: "admin" | "member" | "viewer"
  status: "pending" | "accepted" | "declined" | "expired"
  token: string (UUID)
  invitedBy: ID<"users">
  acceptedBy?: ID<"users">
  acceptedAt?: number
  expiresAt: number
  createdAt: number
  
  indexes: [by_organization, by_email, by_token]
}
```

## Common Tasks

### Find where invitations are created
- See: `/apps/backend/convex/organizations/mutations.ts` (lines 509-600)
- Called from: `InviteMemberDialog` component

### Find where pending invitations are displayed
- See: `/apps/web/src/components/team/pending-invitations-list.tsx`
- Data from: `api.organizations.queries.getPendingInvitations`

### Find permission checks
- See: `/apps/backend/convex/auth.utils.ts`
- Key permission: `ORG_USERS_INVITE`
- Enforced by: `adminMutation` wrapper

### Find database schema
- See: `/apps/backend/convex/schemas/organization_invitations.ts`
- Registered in: `/apps/backend/convex/schema.ts`

### Find types & interfaces
- Frontend types: Auto-generated in `/apps/backend/convex/_generated/api.d.ts`
- See component files for TypeScript interfaces

## Next Steps to Complete

To enable invitations to actually work end-to-end:

1. **Add Email Service** (Priority 1)
   - Choose provider (Resend, Sendgrid, Brevo, etc.)
   - Create email template
   - Send on invitation creation
   - Include magic link with token

2. **Add Acceptance Endpoint** (Priority 2)
   - Create `/accept/:token` public route
   - Create `acceptInvitation` mutation
   - Verify token, fetch invitation, create member
   - Transition invitation status to "accepted"

3. **Add Status Management** (Priority 3)
   - Update invitation status after acceptance
   - Mark as "declined" if rejected
   - Mark as "expired" after 7 days
   - Add cleanup job for expired invitations

4. **Optional Enhancements** (Priority 4)
   - Resend invitation button
   - Bulk invite via CSV
   - Rate limiting
   - Customizable expiration period

## Architecture Highlights

### Permission System
- All operations protected by `adminMutation` wrapper
- Requires `ORG_USERS_INVITE` permission
- Only owner/admin can manage invitations

### Two-Mode Invitations
- **Direct Add**: For users with existing Clerk account
- **Invitation**: For new users without account yet

### Token System
- UUID generated for each invitation
- Stored in database (not used yet)
- Can be used for magic links in future

### Real-Time Updates
- Built on Convex (real-time by default)
- Frontend subscribes to data changes
- Automatic UI updates when invitations change

## Technology Stack

- **Frontend**: React 18, TanStack Router, Convex hooks
- **Backend**: Convex (TypeScript), Convex DB
- **Auth**: Clerk (with custom invitation system)
- **Database**: Convex managed (serverless)
- **Styling**: Tailwind CSS

## Testing Checklist

- [ ] Can create invitation with valid email
- [ ] Can select role before inviting
- [ ] Sees "Member added" if user already exists
- [ ] Sees "Invitation sent" if user is new
- [ ] Can view pending invitations list
- [ ] Can cancel pending invitation
- [ ] Non-admin cannot create invitations
- [ ] Non-admin cannot view invitations
- [ ] Invitations show expiration date
- [ ] Expired invitations show "Expired" badge

## Questions?

Refer to the specific documentation files:
- For overview: `EXPLORATION_COMPLETE.txt`
- For technical details: `INVITATION_SYSTEM_ANALYSIS.md`
- For architecture: `INVITATION_ARCHITECTURE.md`
- For file locations: `INVITATION_FILES_REFERENCE.md`

---

**Documentation Created**: October 27, 2025
**Last Updated**: October 27, 2025
**Status**: Complete exploration of existing system
