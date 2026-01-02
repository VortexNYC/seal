# Shared Documents Improvement Plan

## Objective
Enhance the document sharing experience by consolidating duplicate UI components, integrating a robust notification system, and refining the user experience for sharing workflows.

## Development Priority
1. **Phase 5.1** - Extract shared access logic (reduces bug surface before adding features)
2. **Phase 1** - UI consolidation
3. **Phase 3.3/3.4** - Subscription & member edge cases (lurking bugs)
4. **Phase 2** - Notification system
5. **Remaining phases** - As prioritized

---

## Phase 1: UI Consolidation & UX Polish
**Goal:** Replace the basic `ShareDialog` with the more polished, unused `ShareDocumentDialog` and clean up technical debt.

### 1.1 Analyze and Verify `ShareDocumentDialog`
- [ ] Verify `ShareDocumentDialog.tsx` functionality against the current `ShareDialog.tsx`.
- [ ] Ensure `api.documents.sharing.getDocumentAccess` and `api.documents.sharing.getShareableMembers` (used by the new component) return all necessary data correctly.
- [ ] Check if `ShareDocumentDialog` handles all edge cases (e.g., loading states, error handling, empty states).

### 1.2 Integration
- [ ] Update `apps/web/src/routes/_authenticated/$slug/documents/index.tsx` to import and use `ShareDocumentDialog` instead of `ShareDialog`.
- [ ] Pass required props: `documentId`, `documentName`, `open`, `onOpenChange`.
- [ ] Ensure the "Success" callback (if needed) is handled, likely by refetching data in the parent component.

### 1.3 Cleanup
- [ ] Remove `apps/web/src/components/documents/share-dialog.tsx`.
- [ ] Verify no other references to the old component exist.

---

## Phase 2: Notification System Implementation
**Goal:** Provide immediate in-app feedback when documents are shared, complementing the existing email notifications.

### 2.1 Backend: Notification Schema & Logic
- [ ] Create a `notifications` table in `convex/schema.ts`:
  ```typescript
  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("document_shared"),
      v.literal("document_access_revoked"),
      v.literal("document_access_updated"),
      v.literal("ownership_transferred")
    ),
    data: v.union(
      v.object({ documentId: v.id("documents"), sharedBy: v.id("users"), permissionLevel: v.string() }),
      v.object({ documentId: v.id("documents"), revokedBy: v.id("users") }),
      v.object({ documentId: v.id("documents"), updatedBy: v.id("users"), newPermissionLevel: v.string() }),
      v.object({ documentId: v.id("documents"), previousOwner: v.id("users"), newOwner: v.id("users") })
    ),
    read: v.boolean(),
    createdAt: v.number(),
    emailSent: v.boolean(),
    emailSentAt: v.optional(v.number()),
    emailAttempts: v.optional(v.number()),
  })
  ```
- [ ] Create backend functions in a new `notifications.ts` file:
    - `list`: Query to get user's notifications.
    - `markAsRead`: Mutation to update status.
    - `clearAll`: Mutation to archive/delete.
- [ ] Update `apps/backend/convex/documents/sharing.ts`:
    - In `grantAccess` mutation, insert a record into the `notifications` table for the target user.
    - In `revokeAccess` mutation, insert notification for the revoked user.
    - In `updateAccessLevel` mutation, insert notification for the affected user.
    - In `transferOwnership` mutation, insert notification for both previous and new owner.
- [ ] Track email delivery status: Modify `sendDocumentSharedEmail` action to return success/failure and store in notification record
- [ ] Add retry logic: Schedule retry for failed email notifications (up to 3 attempts)
- [ ] User feedback: Show "notification sent" vs "email failed but access granted" in UI

### 2.2 Frontend: Notification UI
- [ ] Create a `NotificationsPopover` component (bell icon) in the main dashboard layout (`apps/web/src/routes/_authenticated/_layout.tsx` or similar).
- [ ] Display a badge for unread notifications.
- [ ] Render the list of notifications with actions (e.g., "View Document").

---

## Phase 3: Access Control & Granularity
**Goal:** Refine how workspace sharing works, handle subscription edge cases, and manage member lifecycle.

### 3.1 Review Subscription Gates
- [ ] Verify the "Pro Plan" check in `updateSharingMode` aligns with current business rules.
- [ ] Ensure the UI clearly communicates *why* a feature is disabled if the user is on a free plan (the new dialog handles this better visually).

### 3.2 Granular Workspace Sharing (Optional/Future)
- [ ] Investigate adding "Exclude" functionality to "Workspace" sharing (allow all *except* specific users).
- [ ] Investigate "Groups" or "Teams" within an organization for more targeted bulk sharing.

### 3.3 Subscription Lapse Handling (Critical)
**Goal:** Define behavior when a Pro subscription lapses for organizations with shared documents.

- [ ] Define business rule: Should `sharingMode` be downgraded to `"private"` automatically, or grandfather existing shares?
- [ ] Add webhook handler or cron job to detect subscription status changes
- [ ] If downgrading: Update all affected documents' `sharingMode` to `"private"`
- [ ] If downgrading: Revoke all `document_access` records for affected documents
- [ ] Notify affected users (document owners and users who lost access)
- [ ] Add UI banner warning when subscription is about to lapse with shared documents

### 3.4 Organization Member Removal Cleanup (Critical)
**Goal:** Handle cascading effects when a user is removed from an organization.

- [ ] Add cleanup logic to revoke all `document_access` records for the removed user
- [ ] Trigger notification to document owners about cascading access revocation
- [ ] Handle edge case: What happens when the removed user owns documents?
  - [ ] Option A: Transfer ownership to org admin automatically
  - [ ] Option B: Archive documents with grace period for retrieval
  - [ ] Option C: Block removal until ownership is transferred
- [ ] Add Clerk webhook handler for `organizationMembership.deleted` event
- [ ] Log all cascading revocations for audit trail

---

## Phase 4: Testing & Validation

### 4.1 E2E Tests
- [ ] Add E2E tests for the new `ShareDocumentDialog` flow.
- [ ] Test sharing mode transitions (private → workspace → specific).
- [ ] Test permission level changes.
- [ ] Test access revocation flow.

### 4.2 Integration Tests
- [ ] Add unit/integration tests for the notification triggers.
- [ ] Verify permissions: Ensure users with `view` access cannot share or revoke access.
- [ ] Test permission boundaries (view user attempting manage operations).

### 4.3 Edge Case Tests
- [ ] Test subscription lapse scenarios (Pro → Free with active shares).
- [ ] Test organization member removal cascade.
- [ ] Test concurrent access modification (race conditions).
- [ ] Test ownership transfer edge cases.
- [ ] Test self-sharing prevention.

---

## Phase 5: Code Quality & Performance

### 5.1 Extract Shared Access Logic (Do First)
- [ ] Create `apps/backend/convex/auth/access-control.ts` with `checkDocumentAccess(ctx, userId, documentId)` utility
- [ ] Refactor all document queries to use this shared function (6+ locations identified)
- [ ] Add comprehensive unit tests for access control logic
- [ ] Ensure consistent error messages across all access denial scenarios

### 5.2 Add Input Validation
- [ ] In `updateAccessLevel` mutation: Only update database if permission level actually changed
- [ ] Add validation to prevent granting access to document owners (redundant but clearer)
- [ ] Add rate limiting for sharing operations to prevent abuse
- [ ] Validate user is still an active org member before any sharing operation

### 5.3 Audit Trail Enhancements
- [ ] Add `revokedBy` field to document_access table for better audit trails
- [ ] Consider adding IP address logging for security-sensitive operations
- [ ] Add `updatedBy` and `updatedAt` fields to track permission level changes

### 5.4 Ownership Transfer Review
- [ ] Review whether giving the old owner "manage" access is appropriate (consider "edit" access or configurable setting)
- [ ] Add confirmation step in UI before transferring ownership
- [ ] Consider adding "pending transfer" state that requires new owner acceptance

### 5.5 Permission Matrix Documentation
- [ ] Add clear permission matrix table:
  | Permission | View Document | Edit Content | View Access List | Share/Revoke | Transfer Ownership |
  |------------|---------------|--------------|------------------|--------------|-------------------|
  | **View**   | ✓             | ✗            | ✗                | ✗            | ✗                 |
  | **Edit**   | ✓             | ✓            | ✗                | ✗            | ✗                 |
  | **Manage** | ✓             | ✓            | ✓                | ✓            | ✗                 |
  | **Owner**  | ✓             | ✓            | ✓                | ✓            | ✓                 |

### 5.6 Bulk Sharing Operations
- [ ] Add `grantAccessBulk` mutation for sharing with multiple users at once
- [ ] Batch email notifications to avoid rate limiting
- [ ] Add UI for selecting multiple users to share with

### 5.7 Real-time Access Enforcement (Optional/Future)
- [ ] Consider WebSocket/subscription to notify users when their access is revoked mid-session
- [ ] Graceful UI handling when document becomes inaccessible (redirect with message)
- [ ] Add periodic access revalidation for long-running sessions

### 5.8 Performance Optimization
- [ ] Add pagination to `getDocumentAccessList` for documents shared with many users
- [ ] Add caching layer for frequently accessed permission checks
- [ ] Index optimization for large organizations with many shared documents
