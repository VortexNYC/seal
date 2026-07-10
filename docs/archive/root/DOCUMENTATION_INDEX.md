# Seal Project - Documentation Index

## Overview

This project has comprehensive documentation covering the authentication, authorization, database, and component architecture. Choose the document that matches your needs:

---

## Documentation Files

### 1. EXPLORATION_SUMMARY.md

**Purpose**: Complete project overview at a glance  
**Length**: ~15 minutes read  
**Best for**: Getting oriented with the entire system

**Covers**:

- Executive overview
- Complete project structure (backend + frontend)
- Authentication & authorization system
- Database design with all tables
- Permission system deep dive
- User journey & role assignment flows
- Tech stack
- Critical invariants

**Start here if**: You're new to the project

---

### 2. SEAL_ARCHITECTURE.md

**Purpose**: Detailed architectural documentation  
**Length**: ~20 minutes read  
**Best for**: Understanding components and their interactions

**Covers**:

- Project structure with directory tree
- Clerk integration setup
- Authorization system details
- Complete database schema (all 6 tables)
- API structure & patterns (queries/mutations)
- Frontend architecture (routing, components)
- Feature permission matrix
- Error handling
- Integration points for adding features

**Start here if**: You need to understand how things connect

---

### 3. ROLES_AND_PERMISSIONS.md

**Purpose**: In-depth guide to the permission system  
**Length**: ~25 minutes read  
**Best for**: Working with roles, permissions, and access control

**Covers**:

- Quick reference (role hierarchy, key files)
- Database schema for roles & permissions
- Permission system architecture (definitions, mappings, checks)
- Backend permission checking (getAuthContext, mutation examples)
- Frontend permission gating (fetching, conditional rendering)
- Common permission checks in code
- How to add a new permission (5-step process)
- Role assignment flows
- Permission-based features matrix
- Status vs Role explanation
- Document access control (2-tier system)
- Key invariants

**Start here if**: You need to add permissions or understand access control

---

### 4. QUICK_START_ROLES.md

**Purpose**: Quick reference guide  
**Length**: ~8 minutes read  
**Best for**: Quick lookup while coding

**Covers**:

- 5-minute overview of the system
- Role hierarchy diagram
- Database table essentials
- Permission example walkthrough
- Quick file reference table
- Common tasks with code snippets:
  - Adding a new permission
  - Checking user permissions
  - Restricting to admins
  - Changing roles
- Auth flow diagrams
- Permission constants list
- Error handling
- Document access explanation
- Common mistakes to avoid
- Files to know
- Testing permission scenarios

**Start here if**: You need quick answers while coding

---

## Quick Navigation by Task

### I need to understand the entire system

1. Read: **EXPLORATION_SUMMARY.md** (start-to-finish overview)
2. Reference: **SEAL_ARCHITECTURE.md** (detailed specifics)

### I need to add a new permission

1. Go to: **QUICK_START_ROLES.md** → "I need to add a new permission"
2. Reference: **ROLES_AND_PERMISSIONS.md** → "How to Add a New Permission"

### I need to check if a user can do something

1. Go to: **QUICK_START_ROLES.md** → "I need to check if a user can do something"
2. Deep dive: **ROLES_AND_PERMISSIONS.md** → "How Permissions Are Checked"

### I need to restrict a feature to a specific role

1. Go to: **QUICK_START_ROLES.md** → "I need to restrict a feature to admins"
2. Reference: **ROLES_AND_PERMISSIONS.md** → "Query/Mutation Wrapper Patterns"

### I need to change someone's role

1. Go to: **QUICK_START_ROLES.md** → "I need to change someone's role"
2. Reference: **ROLES_AND_PERMISSIONS.md** → "Role Assignment Flow"

### I need to understand database design

1. Read: **EXPLORATION_SUMMARY.md** → "Database Design" section
2. Deep dive: **SEAL_ARCHITECTURE.md** → "Database Schema" section

### I need to understand the frontend

1. Read: **EXPLORATION_SUMMARY.md** → "Frontend Architecture" section
2. Deep dive: **SEAL_ARCHITECTURE.md** → "Frontend Architecture" section

### I need to understand document access control

1. Go to: **QUICK_START_ROLES.md** → "Two-Level Document Access"
2. Deep dive: **ROLES_AND_PERMISSIONS.md** → "Document Access Control"

### I need to understand retired provider invoice flow

1. Read: **features/payments/retired_provider-invoices.md** → retired provider Invoices (Document Send Flow)

---

## Key Concepts

### Authentication vs Authorization

- **Authentication** (Clerk): Is this person who they claim to be?
- **Authorization** (Convex + Database): What can this person do?

### Roles vs Status

- **Role**: What a person CAN do (owner, admin, member, viewer)
- **Status**: Whether a person IS ALLOWED to act (active, suspended, etc.)

### Two-Tier Document Access

- **Org-level**: Role determines if you can create docs (member can, viewer cannot)
- **Doc-level**: Sharing mode (private, workspace, specific) + permission level (view, edit, manage)

### Payments (retired provider Invoices)

- **Draft first**: Invoices are created as drafts for preview (no hosted link yet).
- **Finalize on send**: Finalization generates `hosted_invoice_url` used in emails.
- **Recipient scoped**: Invoice links are only sent to the selected invoice recipient.
- **Cancel behavior**: Drafts are deleted when the send flow is canceled.

### Permission Hierarchy

Permissions are organized by domain:

- `org:*` - Organization management
- `documents:*` - Document operations
- `templates:*` - Template management
- `subscription:*` - Billing & subscriptions
- `audit:*` - Audit logs
- etc.

---

## File Locations

**Main backend files**:

- `/apps/backend/convex/auth.ts` - Auth context
- `/apps/backend/convex/auth.utils.ts` - Permission logic
- `/apps/backend/convex/auth.config.ts` - Clerk config
- `/apps/backend/convex/organizations/queries.ts` - Org queries
- `/apps/backend/convex/organizations/mutations.ts` - Org mutations
- `/apps/backend/convex/documents/` - Document operations

**Main frontend files**:

- `/apps/web/src/main.tsx` - App entry point
- `/apps/web/src/routes/_authenticated/$slug.tsx` - Workspace layout
- `/apps/web/src/components/app-sidebar.tsx` - Main navigation
- `/apps/web/src/components/enforce-organization.tsx` - Org enforcement

---

## Reading Recommendations

**For Different Roles**:

**Project Manager / Product Manager**:

1. EXPLORATION_SUMMARY.md (executive overview)
2. SEAL_ARCHITECTURE.md (features & capabilities)
3. QUICK_START_ROLES.md (understanding constraints)

**Backend Developer**:

1. ROLES_AND_PERMISSIONS.md (full guide)
2. SEAL_ARCHITECTURE.md (API patterns)
3. QUICK_START_ROLES.md (quick reference while coding)

**Frontend Developer**:

1. SEAL_ARCHITECTURE.md (frontend section first)
2. QUICK_START_ROLES.md (permission checks in components)
3. ROLES_AND_PERMISSIONS.md (detailed reference)

**DevOps / System Admin**:

1. EXPLORATION_SUMMARY.md (overview)
2. SEAL_ARCHITECTURE.md (database & structure)
3. Convex docs (deployment specifics not covered here)

**QA / Tester**:

1. QUICK_START_ROLES.md (permission matrix)
2. ROLES_AND_PERMISSIONS.md (scenarios & edge cases)
3. EXPLORATION_SUMMARY.md (invariants & constraints)

---

## Topics Not Covered

These topics are outside the scope of the documentation but are important:

- **Clerk Setup & Configuration** - See Clerk documentation
- **Convex Deployment** - See Convex documentation
- **retired provider Integration** - See retired provider documentation
- **Database Migrations** - Not applicable (Convex handles schema)
- **Frontend Component Library** - See Shadcn UI documentation
- **Styling** - See Tailwind CSS documentation

---

## Quick Reference Tables

### Role Permissions Summary

| Feature            | Owner | Admin | Member | Viewer |
| ------------------ | ----- | ----- | ------ | ------ |
| Create Documents   | ✓     | ✓     | ✓      | ✗      |
| Edit Documents     | ✓     | ✓     | ✓\*    | ✗      |
| Delete Documents   | ✓     | ✓     | ✗      | ✗      |
| Share Documents    | ✓     | ✓     | ✗      | ✗      |
| Download Documents | ✓     | ✓     | ✓      | ✓      |
| View Members       | ✓     | ✓     | ✗      | ✗      |
| Invite Members     | ✓     | ✓     | ✗      | ✗      |
| Change Roles       | ✓     | ✗     | ✗      | ✗      |
| Remove Members     | ✓     | ✗     | ✗      | ✗      |
| Manage Settings    | ✓     | ✗     | ✗      | ✗      |
| View Billing       | ✓     | ✓     | ✗      | ✗      |
| Manage Billing     | ✓     | ✗     | ✗      | ✗      |

\*Members can only edit documents they own or have explicit "edit" access to

### Key Files by Category

**Authentication**:

- `auth.ts` - Context & wrappers
- `auth.utils.ts` - Permission logic
- `auth.config.ts` - Clerk config

**Database Schemas**:

- `schemas/users.ts`
- `schemas/organizations.ts`
- `schemas/organization_members.ts`
- `schemas/organization_invitations.ts`
- `schemas/documents.ts`
- `schemas/document_access.ts`

**Business Logic**:

- `organizations/queries.ts`
- `organizations/mutations.ts`
- `documents/queries.ts`
- `documents/mutations.ts`
- `documents/sharing.ts`

**Frontend Routes**:

- `routes/_auth.tsx` - Public routes
- `routes/_authenticated.tsx` - Protected routes
- `routes/_authenticated/$slug.tsx` - Workspace

**Frontend Components**:

- `components/app-sidebar.tsx`
- `components/enforce-organization.tsx`
- `components/team-switcher.tsx`
- `components/nav-user.tsx`

---

## Document Versions & Updates

These documents were generated on October 27, 2025 based on:

- Seal commit: 55130dd
- React 19.2.0
- Convex 1.28.0
- TanStack Router 1.133.21

Check git history for the most recent updates to the codebase.

---

## Getting Help

If you can't find what you're looking for:

1. Check the **QUICK_START_ROLES.md** "Common Tasks" section
2. Use Ctrl+F to search across documents
3. Check the key files referenced in "File Locations" section
4. Review the "Critical Invariants" section for constraints
5. Look at code examples in **ROLES_AND_PERMISSIONS.md**

---

## Feedback & Improvements

These documents are snapshots of the codebase architecture. As the project evolves:

- Keep these documents updated when adding major features
- Reference these when onboarding new team members
- Use these as a starting point for API documentation
- Reference these in design documents for new features
