# Shared Documents Improvement Plan

**Last Updated**: 2026-02-17

## Objective

Enhance the document sharing experience by consolidating duplicate UI components, integrating a robust notification system, and refining the user experience for sharing workflows.

## Status Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: UI Consolidation | ✅ Complete | ShareDocumentDialog integrated, old dialog removed |
| Phase 2: Notifications | ✅ Complete | In-app + email notifications, retry logic |
| Phase 3: Access Control | ✅ Complete | Subscription gates, lapse handling, member removal |
| Phase 4: Testing | ✅ Complete | E2E + integration tests; advanced edge cases deferred |
| Phase 5: Code Quality | ✅ Core complete | Extracted access control, validation, audit trail; performance/real-time deferred |

## Development Priority

1. **Phase 5.1** - Extract shared access logic (reduces bug surface before adding features)
2. **Phase 1** - UI consolidation
3. **Phase 3.3/3.4** - Subscription & member edge cases (lurking bugs)
4. **Phase 2** - Notification system
5. **Remaining phases** - As prioritized

---

## Phase 1: UI Consolidation & UX Polish ✅

**Goal:** Replace the basic `ShareDialog` with the more polished, unused `ShareDocumentDialog` and clean up technical debt.

### 1.1 Analyze and Verify `ShareDocumentDialog` ✅

- [x] `ShareDocumentDialog` is comprehensive with all edge cases handled:
  - Loading states (ShareDialogSkeleton)
  - Error handling (toast notifications)
  - Empty states ("No one else has access yet", "No team members to add")
  - Free plan restrictions (Pro badges, disabled options, upgrade message)
  - Subscription warning banner
- [x] APIs `getDocumentAccess` and `getShareableMembers` return all necessary data

### 1.2 Integration ✅

- [x] `documents/index.tsx` already imports and uses `ShareDocumentDialog`
- [x] Required props are passed: `documentId`, `documentName`, `open`, `onOpenChange`
- [x] Convex queries auto-refetch on data changes

### 1.3 Cleanup ✅

- [x] No old `share-dialog.tsx` component exists (already removed)
- [x] No orphan references to old component

---

## Phase 2: Notification System Implementation ✅

**Goal:** Provide immediate in-app feedback when documents are shared, complementing the existing email notifications.

### 2.1 Backend: Notification Schema & Logic ✅

- [x] `notifications` table exists in `schemas/notifications.ts` with comprehensive types:
  - `document_shared`, `access_revoked`, `access_updated`, `ownership_transferred`
  - `document_signed`, `document_completed`, `signature_requested`, `reminder`
  - `sharing_disabled`, `bulk_access_revoked`
- [x] Backend functions in `notifications/index.ts`:
  - `list`: Query with pagination and unread filtering
  - `getUnreadCount`: Query for badge count
  - `markAsRead`: Mutation for single notification
  - `markAllAsRead`: Mutation for all notifications
  - `deleteNotification`: Mutation for single deletion
  - `clearAll`: Mutation to delete all
  - `createNotification`: Helper function for creating notifications
- [x] Sharing mutations create notifications via `createNotification` helper
- [x] Email delivery tracking with `emailStatus`, `emailSentAt`, `emailAttempts`, `lastEmailError`
- [x] Retry logic with exponential backoff (up to 3 attempts)
- [x] Email status shown in notification UI (pending/sent/failed indicators)

### 2.2 Frontend: Notification UI ✅

- [x] `NotificationsPopover` component exists at `components/notifications/notifications-popover.tsx`
- [x] Bell icon with unread count badge
- [x] Notification list with type-based icons and messages
- [x] Mark as read (single click and "Mark all read" button)
- [x] Links to documents for actionable notifications
- [x] Email status indicators (pending/sent/failed)
- [x] Loading skeleton and empty state
- [x] Integrated in `AppSidebar` footer

---

## Phase 3: Access Control & Granularity ✅

**Goal:** Refine how workspace sharing works, handle subscription edge cases, and manage member lifecycle.

### 3.1 Review Subscription Gates ✅

- [x] Verify the "Pro Plan" check in `updateSharingMode` aligns with current business rules.
- [x] Ensure the UI clearly communicates _why_ a feature is disabled if the user is on a free plan (Pro badges on workspace/specific options, disabled state, upgrade message).

### 3.2 Granular Workspace Sharing (Optional/Future)

- [ ] Investigate adding "Exclude" functionality to "Workspace" sharing (allow all _except_ specific users).
- [ ] Investigate "Groups" or "Teams" within an organization for more targeted bulk sharing.

### 3.3 Subscription Lapse Handling (Critical) ✅

**Goal:** Define behavior when a Pro subscription lapses for organizations with shared documents.

- [x] Define business rule: `sharingMode` is downgraded to `"private"` automatically
- [x] Add webhook handler to detect subscription status changes (handleSubscriptionDeleted, handleSubscriptionUpdated)
- [x] If downgrading: Update all affected documents' `sharingMode` to `"private"`
- [x] If downgrading: Revoke all `document_access` records for affected documents
- [x] Notify affected users (document owners and users who lost access)
- [x] Add UI banner warning when subscription is past due with shared documents (subscriptionWarning in ShareDocumentDialog)

### 3.4 Organization Member Removal Cleanup (Critical) ✅

**Goal:** Handle cascading effects when a user is removed from an organization.

- [x] Add cleanup logic to revoke all `document_access` records for the removed user
- [x] Trigger notification to document owners about cascading access revocation
- [x] Handle edge case: What happens when the removed user owns documents?
  - [x] Option A: Transfer ownership to org admin automatically (implemented)
  - [ ] Option B: Archive documents with grace period for retrieval
  - [ ] Option C: Block removal until ownership is transferred
- [x] Add Clerk webhook handler for `organizationMembership.deleted` event (deleteMembershipFromClerk)
- [x] Log all cascading revocations for audit trail

---

## Phase 4: Testing & Validation ✅

### 4.1 E2E Tests ✅

- [x] Add E2E tests for the new `ShareDocumentDialog` flow (`apps/web/e2e/tests/document-sharing.spec.ts`).
- [x] Test sharing mode transitions (private → workspace → specific).
- [x] Test permission level changes.
- [x] Test access revocation flow.
- [x] Created `ShareDialogPage` page object (`apps/web/e2e/pages/documents/share-dialog-page.ts`)
- [x] Added `data-testid` attributes to `ShareDocumentDialog` component

### 4.2 Integration Tests ✅

- [x] Add unit/integration tests for database operations (`apps/backend/convex/documents/sharing.test.ts`)
- [x] Set up test infrastructure with `convex-test` and `vitest`
- [x] Created test setup helper (`apps/backend/convex/test.setup.ts`)
- [x] 12 passing tests covering:
  - `document_access` table CRUD operations
  - Sharing mode transitions (private → workspace → specific)
  - Notification creation for all types (document_shared, access_revoked, access_updated)
  - Index queries (by_document, by_document_user, by_user)

### 4.3 Edge Case Tests (Future Enhancement)

- [ ] Test subscription lapse scenarios (Pro → Free with active shares).
- [ ] Test organization member removal cascade.
- [ ] Test concurrent access modification (race conditions).
- [ ] Test ownership transfer edge cases.
- [ ] Test self-sharing prevention.

**Note:** These advanced tests can be added as the test infrastructure matures.

---

## Phase 5: Code Quality & Performance

### 5.1 Extract Shared Access Logic ✅

- [x] `apps/backend/convex/auth/access_control.ts` already exists with `checkDocumentAccess` utility
- [x] Refactored `audit_logs/queries.ts` to use shared `checkDocumentAccess`
- [x] Refactored `documents/activity_queries.ts` to use shared `checkDocumentAccess`
- [x] Refactored `documents/recipients_queries.ts` to use shared `checkDocumentAccess`
- [x] Uses consistent error messages via `ACCESS_ERRORS` constants
- [x] All static analysis checks pass
- [x] All existing tests pass (12/12)

### 5.2 Add Input Validation ✅

- [x] In `updateAccessLevel` mutation: Only update database if permission level actually changed (returns `{ success: true, noChange: true }` for no-op)
- [x] Add validation to prevent granting access to document owners (throws "Cannot grant access to document owner - they already have full access")
- [ ] Add rate limiting for sharing operations to prevent abuse (deferred - requires additional infrastructure)
- [x] Validate user is still an active org member in `updateAccessLevel` (uses `getActiveMembership` helper)
- Note: `revokeAccess` intentionally allows revoking from inactive members for cleanup scenarios

### 5.3 Audit Trail Enhancements ✅

- [x] Add `revokedBy` field to document_access table for better audit trails
- [ ] Consider adding IP address logging for security-sensitive operations (deferred - requires infrastructure changes)
- [x] Add `updatedBy` and `updatedAt` fields to track permission level changes
- [x] Updated `revokeAccess` mutation to populate `revokedBy`
- [x] Updated `updateAccessLevel` mutation to populate `updatedBy`/`updatedAt`
- [x] Updated `grantAccess` mutation to clear `revokedBy` and set audit fields on re-grant

### 5.4 Ownership Transfer Review ✅

- [x] Reviewed: Old owner getting "manage" access is appropriate - they retain administrative capabilities, new owner can demote if needed
- [ ] Add confirmation step in UI before transferring ownership (frontend change - deferred)
- [ ] Consider adding "pending transfer" state that requires new owner acceptance (complex feature - deferred to future iteration)

### 5.5 Permission Matrix Documentation ✅

Permission matrix for document access levels:

| Permission | View Document | Edit Content | View Access List | Share/Revoke | Transfer Ownership |
| ---------- | ------------- | ------------ | ---------------- | ------------ | ------------------ |
| **View**   | ✓             | ✗            | ✗                | ✗            | ✗                  |
| **Edit**   | ✓             | ✓            | ✗                | ✗            | ✗                  |
| **Manage** | ✓             | ✓            | ✓                | ✓            | ✗                  |
| **Owner**  | ✓             | ✓            | ✓                | ✓            | ✓                  |

**Notes:**

- Workspace sharing grants implicit "view" access to all org members
- Owner always has full access regardless of sharing mode
- "Manage" permission allows sharing but not ownership transfer

### 5.6 Bulk Sharing Operations ✅

- [x] Add `grantAccessBulk` mutation for sharing with multiple users at once (max 50 users per call)
- [x] Batch processing with individual email notifications per user
- [ ] Add UI for selecting multiple users to share with (frontend change - deferred)

### 5.7 Real-time Access Enforcement (Optional/Future)

- [ ] Consider WebSocket/subscription to notify users when their access is revoked mid-session
- [ ] Graceful UI handling when document becomes inaccessible (redirect with message)
- [ ] Add periodic access revalidation for long-running sessions

**Status:** Deferred - Convex real-time subscriptions already handle most cases. Consider for v2.

### 5.8 Performance Optimization

- [ ] Add pagination to `getDocumentAccess` for documents shared with many users
- [ ] Add caching layer for frequently accessed permission checks
- [ ] Index optimization for large organizations with many shared documents

**Status:** Deferred - Current implementation handles typical usage (< 50 shared users per document). Indexes are already in place. Consider if performance issues arise.
