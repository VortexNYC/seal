# Seal Development Tickets

**Parent Tasks = PRs | Child Tasks = Work Items**

## Structure

- **Parent Tasks** = Mergeable PRs with complete features
- **Child Tasks** = Individual work items to complete the parent
- **Dependencies** = Can't start parent N+1 until parent N is merged

---

## Layer 1: Foundation

### Parent #1: Monorepo Setup & Configuration

**PR Goal:** Monorepo working with Turborepo, Bun, Biome, TypeScript

**Child Tasks:**

- 1.1: Initialize Turborepo monorepo with complete folder structure and Bun workspaces
- 1.2: Configure all tooling (Biome linter/formatter, shared TypeScript configs, Turborepo pipeline)
- 1.3: Verify all scripts work (build, dev, lint, format, typecheck)

**Acceptance Criteria:**
**Monorepo Structure:**

- [ ] Root directory structure matches `/docusign-oss-vision.md` lines 14-31
- [ ] `/apps/web` created for main web application
- [ ] `/apps/docs` created for API documentation site
- [ ] `/packages/ui` created for shared shadcn/ui components
- [ ] `/packages/convex` created for Convex backend
- [ ] `/packages/api` created for public REST API layer
- [ ] `/packages/shared` created for shared utilities and types
- [ ] `/tooling/biome` and `/tooling/typescript` created
- [ ] Root `package.json` configured with Bun workspaces

**Turborepo & Tooling:**

- [ ] `turbo.json` configured with build, dev, lint, format, typecheck pipelines
- [ ] Biome configured for linting and formatting
- [ ] Shared TypeScript configs in `/tooling/typescript`
- [ ] Each package extends shared TypeScript config

**Scripts Working:**

- [ ] `bun install` installs all dependencies without errors
- [ ] `turbo build` builds all packages successfully
- [ ] `bun run dev` starts development servers
- [ ] `bun run lint` lints entire monorepo
- [ ] `bun run format` formats all code
- [ ] `bun run typecheck` validates TypeScript across all packages

**Dependencies:** None

**Docs:**

- `/docusign-oss-vision.md` (lines 14-31, 43-113)
- `/README.md`

---

### Parent #2: Vite + React + Tailwind Setup

**PR Goal:** React app running with Tailwind and design tokens configured

**Child Tasks:**

- 2.1: Initialize Vite + React with TypeScript and basic App component
- 2.2: Install and configure Tailwind CSS with design tokens from spec
- 2.3: Test dev server, HMR, and Tailwind classes working

**Acceptance Criteria:**
**Vite Setup:**

- [ ] Vite project initialized in `/apps/web`
- [ ] TypeScript configured correctly
- [ ] `vite.config.ts` configured with proper plugins
- [ ] Dev server starts on `localhost:5173`
- [ ] Hot Module Replacement (HMR) works
- [ ] Production build works (`vite build`)

**React 19 Setup:**

- [ ] React 19 installed
- [ ] Basic App component renders
- [ ] TypeScript types working for React components
- [ ] React DevTools work in browser
- [ ] React 19 features available (use, useActionState, etc.)

**Tailwind CSS 4:**

- [ ] Tailwind CSS v4 installed and configured
- [ ] Tailwind config using new v4 format
- [ ] CSS imports configured correctly for v4
- [ ] Tailwind classes apply correctly
- [ ] Oxide engine enabled for fast builds
- [ ] Purging works for production builds

**Design Tokens:**

- [ ] Colors match `/design-phase/ui-specifications/design-tokens.md`
- [ ] Typography scale matches spec (Tailwind v4 format)
- [ ] Spacing scale configured
- [ ] Border radius values configured
- [ ] Shadow values configured
- [ ] Custom Tailwind theme configured in v4 format

**Dependencies:** Parent #1

**Docs:**

- `/docusign-oss-vision.md` (lines 49-52)
- `/design-phase/ui-specifications/design-tokens.md`
- `/design-phase/ui-specifications/typography.md`

---

### Parent #3: shadcn/ui Component Library

**PR Goal:** All core shadcn/ui components installed and working

**Child Tasks:**

- 3.1: Initialize shadcn/ui and install all 10 core components (Button, Card, Input, Label, Form, Dialog, DropdownMenu, Avatar, Separator, Toast)
- 3.2: Create component index and demo page showing all components
- 3.3: Test all components render correctly and are responsive

**Acceptance Criteria:**
**shadcn/ui Setup:**

- [ ] shadcn/ui CLI installed (`npx shadcn-ui@latest init`)
- [ ] `components.json` configured correctly
- [ ] Component directory set to `/packages/ui/src/components`
- [ ] Tailwind config paths updated for shadcn
- [ ] CSS variables defined for theming
- [ ] TypeScript paths configured for component imports

**Core Components Installed:**

- [ ] Button component functional with all variants
- [ ] Card component (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- [ ] Input component with validation states
- [ ] Label component paired with inputs
- [ ] Form component with react-hook-form integration
- [ ] Dialog component (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription)
- [ ] DropdownMenu component fully functional
- [ ] Avatar component with fallback support
- [ ] Separator component for visual divisions
- [ ] Toast component for notifications (Sonner integration)

**Component Quality:**

- [ ] All components match `/design-phase/ui-specifications/component-library.md`
- [ ] Components use design tokens from spec
- [ ] Components accessible (ARIA attributes)
- [ ] Components responsive on mobile (320px+)
- [ ] Dark mode support (if applicable)
- [ ] Keyboard navigation works
- [ ] Demo page showcases all component variants

**Dependencies:** Parent #2

**Docs:**

- `/design-phase/ui-specifications/component-library.md`
- `/design-phase/ascii-to-shadcn-mapping.md`

---

### Parent #4: TanStack Router + Basic Routes

**PR Goal:** Routing working with all main pages accessible

**Child Tasks:**

- 4.1: Install TanStack Router and create all routes (root, index, auth/sign-in, auth/sign-up, dashboard)
- 4.2: Build auth layout (centered card) and dashboard layout (sidebar + content)
- 4.3: Test navigation between routes and type-safe routing

**Acceptance Criteria:**
**TanStack Router Setup:**

- [ ] TanStack Router v1 installed
- [ ] Router configured in app entry point
- [ ] File-based routing enabled
- [ ] Route tree generated correctly
- [ ] TypeScript types generated for routes

**Routes Created:**

- [ ] Root route (`/`) created
- [ ] Index route renders landing page
- [ ] `/auth/sign-in` route created
- [ ] `/auth/sign-up` route created
- [ ] `/dashboard` route created
- [ ] All routes have placeholder content
- [ ] Type-safe route paths working

**Layouts:**

- [ ] Auth layout component created (centered card design)
- [ ] Auth layout applies to sign-in and sign-up routes
- [ ] Dashboard layout component created (sidebar + main content)
- [ ] Dashboard layout properly structures content area
- [ ] Layouts responsive on mobile

**Navigation:**

- [ ] `Link` component used for navigation
- [ ] Navigation between all routes works
- [ ] Browser back/forward buttons work
- [ ] Active route indicated visually
- [ ] Type-safe `useNavigate` hook working
- [ ] No console errors during navigation
- [ ] Route transitions smooth

**Sitemap Compliance:**

- [ ] Routes match structure in `/design-phase/information-architecture/sitemap.md`
- [ ] Navigation structure follows `/design-phase/information-architecture/navigation-structure.md`

**Dependencies:** Parent #3

**Docs:**

- `/design-phase/information-architecture/sitemap.md`
- `/design-phase/information-architecture/navigation-structure.md`

---

### Parent #5: Error Handling & Loading States

**PR Goal:** Error boundaries, error pages, and loading states complete

**Child Tasks:**

- 5.1: Build error boundary, 404, and 500 error pages with router integration
- 5.2: Create loading spinner and skeleton components (Card, List, Form)
- 5.3: Add loading states to all routes and test skeleton layouts

**Acceptance Criteria:**
**Error Boundary:**

- [ ] React Error Boundary component created
- [ ] Error boundary wraps entire app
- [ ] Catches and displays JavaScript errors
- [ ] Shows friendly error message to users
- [ ] Logs errors to console in development
- [ ] "Try Again" button resets error boundary

**Error Pages:**

- [ ] 404 Page: Shows when route doesn't exist
- [ ] 404 includes helpful navigation links
- [ ] 500 Page: Shows for server/app errors
- [ ] Error pages match `/features/system/error-pages/wireframes/01-error-states.md`
- [ ] Error pages responsive on mobile
- [ ] Error pages maintain brand consistency

**Loading States:**

- [ ] Loading spinner component created
- [ ] Card skeleton component created
- [ ] List skeleton component created
- [ ] Form skeleton component created
- [ ] Route transitions show loading spinner
- [ ] Skeletons match actual component dimensions
- [ ] Loading states follow `/design-phase/interaction-patterns/loading-states.md`
- [ ] Enhanced loading patterns from `/design-phase/interaction-patterns/enhanced-loading-states.md`
- [ ] Skeleton screens prevent layout shift
- [ ] Loading states accessible (aria-busy, aria-live)

**Dependencies:** Parent #4

**Docs:**

- `/features/system/error-pages/feature-spec.md`
- `/features/system/error-pages/wireframes/01-error-states.md`
- `/design-phase/interaction-patterns/loading-states.md`
- `/design-phase/interaction-patterns/enhanced-loading-states.md`

---

### Parent #6: Convex Setup + User Schema

**PR Goal:** Convex working with user CRUD operations

**Child Tasks:**

- 6.1: Initialize Convex project and create users table schema with queries/mutations
- 6.2: Add Zod validation schemas for all user operations
- 6.3: Test all queries and mutations in Convex dashboard

**Acceptance Criteria:**
**Convex Project Setup:**

- [ ] Convex account created
- [ ] Convex project initialized (`bunx convex dev`)
- [ ] Convex dev deployment running
- [ ] Environment variables configured
- [ ] Convex dashboard accessible

**User Schema:**

- [ ] `users` table schema defined in `convex/schema.ts`
- [ ] Fields: id, email, name, avatar, clerkId, createdAt, updatedAt
- [ ] Indexes created on clerkId and email
- [ ] Schema follows `/design-phase/information-architecture/data-relationships.md`

**Queries:**

- [ ] `getUser(id)` query returns user by ID
- [ ] `getUserByEmail(email)` query works
- [ ] `getUserByClerkId(clerkId)` query works
- [ ] `listUsers()` query returns all users
- [ ] Queries tested in Convex dashboard
- [ ] Queries return correct TypeScript types

**Mutations:**

- [ ] `createUser` mutation creates new user
- [ ] `updateUser` mutation updates existing user
- [ ] `deleteUser` mutation removes user
- [ ] Mutations tested in Convex dashboard
- [ ] Mutations enforce data constraints

**Zod Validation:**

- [ ] Zod schemas created in `/packages/shared`
- [ ] User creation schema validates required fields
- [ ] Email format validation works
- [ ] Invalid data rejected with clear error messages
- [ ] Validation schemas shared between frontend and Convex

**Dependencies:** Parent #5

**Docs:**

- `/design-phase/information-architecture/data-relationships.md`
- `/docusign-oss-vision.md` (lines 56-58, 67-70)

---

### Parent #7: Connect Frontend to Convex

**PR Goal:** Frontend reading/writing to Convex with real-time updates

**Child Tasks:**

- 7.1: Install Convex React client and configure ConvexProvider
- 7.2: Create test page displaying users with loading and error states
- 7.3: Test real-time updates and optimistic UI

**Acceptance Criteria:**
**Convex React Client:**

- [ ] Convex React client installed
- [ ] `ConvexProvider` wraps app in entry point
- [ ] Convex client URL configured
- [ ] Environment variables set for Convex

**Test Page:**

- [ ] Test page created displaying user list
- [ ] `useQuery` hook fetches users from Convex
- [ ] Data displays correctly in UI
- [ ] Empty state shows when no users
- [ ] Loading spinner shows during fetch
- [ ] Error message displays if query fails

**Real-Time Updates:**

- [ ] Data updates automatically without refresh
- [ ] Multiple browser tabs sync in real-time
- [ ] Convex subscriptions working correctly
- [ ] No manual polling required

**Optimistic UI:**

- [ ] `useMutation` hook configured
- [ ] Optimistic updates show immediately
- [ ] UI reverts if mutation fails
- [ ] Success/error feedback shown
- [ ] Mutations feel instant to user

**Dependencies:** Parent #6

**Docs:**

- `/docusign-oss-vision.md` (lines 56-58)
- `/design-phase/state-documentation-patterns.md`

---

### Parent #8: Database Schemas (Organizations, Documents, Signatures)

**PR Goal:** All core database schemas defined and related

**Child Tasks:**

- 8.1: Create all 5 table schemas (organizations, workspaces, documents, signatures, audit_logs)
- 8.2: Add relationships and indexes between tables
- 8.3: Test querying related data across tables

**Acceptance Criteria:**

- [ ] Organizations, workspaces, documents, signatures, and audit logs all stored in database
- [ ] Data relationships working (organizations contain workspaces, workspaces contain documents, etc.)
- [ ] Can retrieve organization and see all its workspaces
- [ ] Can retrieve workspace and see all its documents
- [ ] Can retrieve document and see all signatures and audit history
- [ ] Database queries return results quickly (no performance issues)
- [ ] All data follows structure defined in `/design-phase/information-architecture/data-relationships.md`

**Dependencies:** Parent #7

**Docs:**

- `/design-phase/information-architecture/data-relationships.md`

---

### Parent #9: Clerk Setup + Sign-Up Flow

**PR Goal:** Users can sign up with email/password and verify email

**Child Tasks:**

- 9.1: Setup Clerk integration (application, SDK, environment, ClerkProvider)
- 9.2: Build sign-up form with email/password validation and OTP verification
- 9.3: Implement verification flow (OTP page, resend, error handling, redirect to workspace creation)

**Acceptance Criteria:**

- [ ] Sign-up form accepts email and password
- [ ] Email format validated before submission
- [ ] Password strength requirements enforced
- [ ] User receives verification email with 6-digit code
- [ ] OTP verification page allows code entry
- [ ] Correct code verifies email successfully
- [ ] Incorrect code shows clear error message
- [ ] Can resend verification code if not received
- [ ] After verification, redirects to workspace creation
- [ ] All forms match wireframes in docs
- [ ] Mobile-responsive sign-up experience

**Dependencies:** Parent #8

**Docs:**

- `/features/authentication/user-registration/feature-spec.md`
- `/features/authentication/user-registration/wireframes/02-sign-up-form.md`
- `/features/authentication/user-registration/wireframes/04-otp-verification.md`
- `/design-phase/interaction-patterns/form-patterns.md`

---

### Parent #10: Sign-In + Password Reset

**PR Goal:** Users can sign in and reset password

**Child Tasks:**

- 10.1: Build sign-in form with email/password and OAuth buttons (Google, Microsoft, Apple)
- 10.2: Implement sign-in flows (password, OAuth, "Remember me" functionality)
- 10.3: Build password reset flow (forgot password page, email sending, reset page, password update)

**Acceptance Criteria:**

- [ ] Sign-in form accepts email and password
- [ ] Valid credentials log user in successfully
- [ ] Invalid credentials show "Invalid email or password" error
- [ ] Google OAuth button works for sign-in
- [ ] Microsoft OAuth button works for sign-in
- [ ] Apple OAuth button works for sign-in
- [ ] "Remember me" checkbox keeps user logged in
- [ ] "Forgot Password?" link navigates to reset page
- [ ] Password reset sends email with reset link
- [ ] Reset link opens password reset page
- [ ] User can enter and save new password
- [ ] Can sign in with newly reset password
- [ ] All forms match wireframes in docs

**Dependencies:** Parent #9

**Docs:**

- `/features/authentication/user-registration/wireframes/03-sign-in-form.md`
- `/features/authentication/user-registration/wireframes/05-password-reset.md`

---

### Parent #11: Protected Routes + Clerk-Convex Sync

**PR Goal:** Auth working end-to-end with Clerk users syncing to Convex

**Child Tasks:**

- 11.1: Build protected routes with redirect and URL preservation
- 11.2: Configure Convex to validate Clerk JWT tokens and setup webhook endpoint
- 11.3: Implement user sync system (create, update, delete mutations) and test end-to-end auth flow

**Acceptance Criteria:**

- [ ] Unauthenticated users automatically redirected to sign-in page
- [ ] Authenticated users can access dashboard and protected pages
- [ ] After login, user redirected back to page they tried to access
- [ ] User data from Clerk automatically synced to Convex database
- [ ] User profile updates in Clerk reflected in Convex
- [ ] User deletion in Clerk removes data from Convex
- [ ] All backend queries know who the current user is
- [ ] Users can only see their own workspace data
- [ ] Auth works seamlessly across entire app

**Dependencies:** Parent #10

**Docs:**

- `/features/authentication/user-registration/feature-spec.md` (Clerk + Convex Integration)

---

### Parent #12: User Profile & Settings

**PR Goal:** User profile management with notification preferences and account settings

**Child Tasks:**

- 12.1: Build profile settings page with avatar upload, name, email, and bio fields
- 12.2: Create notification preferences UI with toggle controls for email, in-app, and desktop notifications
- 12.3: Implement account settings (password change, MFA setup, session management, account deletion), add usage statistics dashboard
- 12.4: Create integrations settings page with API key management and connected apps

**Acceptance Criteria:**
**Profile Settings:**

- [ ] Profile settings page accessible from user menu
- [ ] Avatar upload working with image preview
- [ ] Can update name, email, bio
- [ ] Profile changes sync to Clerk and Convex
- [ ] Profile picture displays throughout app
- [ ] Form validation for all fields
- [ ] Changes save successfully with confirmation message

**Notification Preferences:**

- [ ] Notification preferences page accessible from settings
- [ ] Email notifications toggle (document events, reminders, weekly digest)
- [ ] In-app notifications toggle
- [ ] Desktop notifications toggle with browser permission request
- [ ] Notification frequency selector (instant, daily, weekly)
- [ ] Preferences save immediately with optimistic UI
- [ ] Preferences respected across all notification types

**Account Settings:**

- [ ] Change password functionality working
- [ ] Password strength indicator displayed
- [ ] MFA setup available (TOTP authenticator app)
- [ ] MFA can be enabled and disabled
- [ ] Active sessions list displayed with device info
- [ ] Can revoke individual sessions
- [ ] "Sign out all devices" button working
- [ ] Account deletion flow with confirmation
- [ ] Deleted accounts remove all user data

**Usage Statistics:**

- [ ] Usage dashboard shows document statistics
- [ ] Monthly document count displayed
- [ ] Signature requests sent vs. completed
- [ ] Storage usage indicator
- [ ] API usage metrics (if applicable)
- [ ] Usage limits shown based on subscription tier
- [ ] Upgrade prompt when approaching limits

**Integrations:**

- [ ] Integrations settings page accessible
- [ ] API key generation working
- [ ] API keys displayed with copy button
- [ ] Can revoke API keys
- [ ] Connected apps list (OAuth integrations)
- [ ] Can disconnect third-party apps
- [ ] Integration activity logs visible

**Dependencies:** Parent #11

**Docs:**

- `/features/authentication/user-profile/feature-spec.md`
- `/features/authentication/user-profile/user-flows.md`
- `/features/authentication/user-profile/wireframes/01-profile-settings.md`
- `/features/authentication/user-profile/wireframes/02-notification-preferences.md`
- `/features/authentication/user-profile/wireframes/03-usage-statistics.md`
- `/features/authentication/user-profile/wireframes/04-account-settings.md`
- `/features/authentication/user-profile/wireframes/05-integrations-settings.md`

---

### Parent #13: retired provider Billing & Subscription

**PR Goal:** retired provider integration complete with subscription management

**Child Tasks:**

- 13.1: Setup retired provider account and configure products (Free, Pro plans), install retired provider SDK and create Convex integration
- 13.2: Build billing dashboard showing current plan, usage, payment method, and invoices
- 13.3: Implement subscription checkout flow with retired provider Checkout, add upgrade/downgrade functionality, configure webhook handlers for subscription events
- 13.4: Create customer portal integration for managing payment methods and viewing invoices

**Acceptance Criteria:**
**retired provider Configuration:**

- [ ] retired provider account created and verified
- [ ] retired provider products configured (Free tier, Pro tier)
- [ ] Product pricing set correctly
- [ ] retired provider SDK installed in project
- [ ] retired provider API keys configured (test and production)
- [ ] Convex integration with retired provider working

**Billing Dashboard:**

- [ ] Billing page accessible from settings
- [ ] Current plan displayed prominently
- [ ] Plan features listed
- [ ] Usage metrics shown (documents sent, storage used, API calls)
- [ ] Usage limits displayed based on plan
- [ ] Payment method displayed (last 4 digits)
- [ ] Billing history/invoices list visible
- [ ] Next billing date shown for paid plans

**Subscription Management:**

- [ ] "Upgrade to Pro" button visible on free plan
- [ ] Clicking upgrade opens retired provider Checkout
- [ ] retired provider Checkout accepts test card payments
- [ ] Successful payment redirects back to app
- [ ] Subscription status updates in database
- [ ] User sees updated plan after upgrade
- [ ] "Downgrade to Free" option available on Pro plan
- [ ] Downgrade confirmation modal shown
- [ ] Downgrade processes at end of billing period
- [ ] Cancellation flow working correctly

**Webhook Integration:**

- [ ] retired provider webhook endpoint created in Convex
- [ ] Webhook signature verification working
- [ ] `customer.subscription.created` event handled
- [ ] `customer.subscription.updated` event handled
- [ ] `customer.subscription.deleted` event handled
- [ ] `invoice.payment_succeeded` event handled
- [ ] `invoice.payment_failed` event handled
- [ ] Failed payment notifications sent to user
- [ ] Subscription status synced to database on all events

**Customer Portal:**

- [ ] "Manage Billing" button opens retired provider Customer Portal
- [ ] Can update payment method in portal
- [ ] Can view invoice history in portal
- [ ] Can download invoices as PDF
- [ ] Can cancel subscription from portal
- [ ] Portal redirects back to app correctly

**Usage Enforcement:**

- [ ] Free tier limits enforced (e.g., 5 documents/month)
- [ ] Pro tier limits enforced (e.g., unlimited documents)
- [ ] Limit exceeded shows upgrade prompt
- [ ] Users blocked from actions when limit reached
- [ ] Usage resets monthly

**Dependencies:** Parent #12

**Docs:**

- `/features/workspace-management/billing-subscription/feature-spec.md`
- `/features/workspace-management/billing-subscription/user-flows.md`
- `/features/workspace-management/billing-subscription/wireframes/01-billing-dashboard.md`
- `/docusign-oss-vision.md` (line 60)

---

### Parent #14: Workspace Creation Flow

**PR Goal:** Users create workspace during sign-up

**Child Tasks:**

- 14.1: Build workspace creation page with form (name, type) and validation
- 14.2: Implement Clerk organization creation and sync to Convex (webhooks, mutations, ownership)
- 14.3: Build workspace switcher dropdown and test multi-workspace functionality

**Acceptance Criteria:**

- [ ] After email verification, workspace creation page displays
- [ ] Form requires workspace name (cannot be empty)
- [ ] Workspace name validated before submission
- [ ] Workspace created successfully in both Clerk and Convex
- [ ] User automatically assigned as workspace owner
- [ ] After creation, redirected to dashboard
- [ ] Dashboard shows current workspace name in header
- [ ] Workspace switcher dropdown available (if user in multiple workspaces)
- [ ] Switching workspaces updates entire app context
- [ ] All document operations scoped to current workspace
- [ ] Users can only see documents in their current workspace

**Dependencies:** Parent #13

**Docs:**

- `/features/authentication/user-registration/wireframes/06-workspace-creation.md`
- `/features/workspace-management/organization-management/feature-spec.md`
- `/features/workspace-management/organization-management/wireframes/01-workspace-creation.md`
- `/features/workspace-management/organization-management/wireframes/03-workspace-switching.md`

---

## Layer 2: Document Management

### Parent #15: PDF Upload to Convex Storage

**PR Goal:** Users can upload PDFs with drag-and-drop

**Child Tasks:**

- 15.1: Configure Convex file storage and create file upload mutation
- 15.2: Build drag-and-drop upload zone component with file picker fallback, drop zone styling on drag-over, and handle file drop event
- 15.3: Validate file type (PDF only) and file size (max 50MB), show error messages for invalid files
- 15.4: Add upload progress indicator displaying percentage and file name, handle upload completion and errors

**Acceptance Criteria:**

- [ ] Drag-and-drop zone displays with clear visual cues
- [ ] Drop zone shows visual feedback during drag-over
- [ ] File picker button works as fallback to drag-and-drop
- [ ] Multiple file selection prevented (one at a time)
- [ ] Upload progress indicator shows percentage and file name
- [ ] Progress bar updates smoothly during upload
- [ ] File type validation: Only PDF files accepted
- [ ] File size validation: Maximum 50MB enforced
- [ ] Non-PDF files show error: "Only PDF files are supported"
- [ ] Oversized files show error: "File size must be under 50MB"
- [ ] Files upload successfully to Convex storage
- [ ] Network interruptions trigger retry with exponential backoff
- [ ] User can navigate away warning: "Upload in progress. Are you sure?"
- [ ] Upload completion triggers success message
- [ ] Upload errors display with clear recovery instructions
- [ ] Mobile-responsive upload interface works on all devices

**Dependencies:** Parent #14

**Docs:**

- `/features/document-management/document-upload/feature-spec.md`
- `/features/document-management/document-upload/user-flows.md`
- `/features/document-management/document-upload/wireframes/01-document-upload-interface.md`
- `/design-phase/interaction-patterns/drag-drop-patterns.md`
- `/design-phase/interaction-patterns/enhanced-loading-states.md`

---

### Parent #16: PDF Preview & Metadata

**PR Goal:** Uploaded PDFs show thumbnail and metadata

**Child Tasks:**

- 16.1: Install `react-pdf` library, generate PDF thumbnail from first page, display thumbnail after upload, handle PDF rendering errors
- 16.2: Extract page count and file size from PDF, format file size (KB, MB) for display, display metadata below thumbnail
- 16.3: Create `createDocument` mutation to save title, fileUrl, pageCount, fileSize, workspaceId, link document to workspace and user, show success message after save

**Acceptance Criteria:**

- [ ] `react-pdf` library installed and configured
- [ ] PDF thumbnail generates from first page automatically
- [ ] Thumbnail displays at appropriate size (200x300px max)
- [ ] PDF rendering errors caught and handled gracefully
- [ ] Error state shows: "Unable to generate preview"
- [ ] Page count extracted from PDF accurately
- [ ] File size extracted and formatted (KB, MB display)
- [ ] Document title extracted from PDF metadata or filename
- [ ] Metadata displayed below thumbnail (title, pages, size)
- [ ] `createDocument` mutation saves to Convex
- [ ] Document record includes: title, fileUrl, pageCount, fileSize, workspaceId, uploadedAt, userId
- [ ] Document linked to authenticated user
- [ ] Document linked to current workspace
- [ ] Workspace-scoped access control enforced
- [ ] Success message displays: "Document uploaded successfully"
- [ ] Document immediately available in library

**Dependencies:** Parent #15

**Docs:**

- `/pdf-library-architecture.md` (react-pdf section)
- `/features/document-management/document-upload/feature-spec.md`
- `/features/document-management/document-upload/user-flows.md`
- `/features/document-management/document-upload/wireframes/02-document-preview-management.md`
- `/features/document-management/document-processing/feature-spec.md`
- `/features/document-management/document-processing/user-flows.md`
- `/features/document-management/document-processing/wireframes/01-processing-interface.md`

---

### Parent #17: Document Library Page

**PR Goal:** Users can view all their documents in a list

**Child Tasks:**

- 17.1: Create document library page route, query documents for current workspace, create document list table component displaying columns: thumbnail, title, upload date, status
- 17.2: Add empty state for no documents, add sort by date (newest/oldest) and by name (A-Z, Z-A), add sort indicators to column headers
- 17.3: Implement pagination (20 per page) with prev/next buttons, page number display, and edge case handling (first/last page)

**Acceptance Criteria:**

- [ ] Document library page shows all workspace documents in table
- [ ] Each row displays: thumbnail, title, upload date, status
- [ ] Empty state displays when no documents uploaded yet
- [ ] Empty state shows helpful message and upload button
- [ ] Click column headers to sort (date, name, status)
- [ ] Sort direction toggles between ascending/descending
- [ ] Visual indicator shows current sort column and direction
- [ ] Pagination controls appear when more than 20 documents
- [ ] Shows 20 documents per page
- [ ] Previous/Next buttons navigate between pages
- [ ] Current page number displayed
- [ ] Buttons disabled appropriately (prev on page 1, next on last page)
- [ ] Library works smoothly on mobile devices

**Dependencies:** Parent #16

**Docs:**

- `/features/document-management/document-library/feature-spec.md`
- `/features/document-management/document-library/user-flows.md`
- `/features/document-management/document-library/wireframes/01-main-library-interface.md`

---

### Parent #18: Search & Filters

**PR Goal:** Users can search and filter documents

**Child Tasks:**

- 18.1: Install `fuse.js`, add search input above document list, implement fuzzy search on title and description, show search results in real-time as user types, add clear button to reset search, highlight matching text in results
- 18.2: Add status filter dropdown (draft, sent, completed) and date range filter with picker, implement filter logic in Convex queries
- 18.3: Show active filters as removable chips, allow removing individual filters, test search + filters work together

**Acceptance Criteria:**

- [ ] Search input appears above document list
- [ ] Typing in search filters documents in real-time
- [ ] Fuzzy matching finds documents even with typos
- [ ] Matching text highlighted in search results
- [ ] Clear button (X) resets search instantly
- [ ] Status filter dropdown shows: All, Draft, Sent, Completed
- [ ] Selecting status filters document list immediately
- [ ] Date range filter allows selecting start and end dates
- [ ] Active filters displayed as removable chips
- [ ] Clicking X on filter chip removes that filter
- [ ] Search and filters work together (both applied)
- [ ] Results update immediately as filters change
- [ ] No results state shows helpful message

**Dependencies:** Parent #17

**Docs:**

- `/features/document-management/search-filtering/feature-spec.md`
- `/features/document-management/search-filtering/user-flows.md`
- `/features/document-management/search-filtering/wireframes/01-search-interface.md`

---

### Parent #19: Full PDF Viewer

**PR Goal:** Users can view PDFs full-screen with controls

**Child Tasks:**

- 19.1: Install `@react-pdf-viewer/core`, create full-page PDF viewer component
- 19.2: Add zoom controls (in, out, fit), page navigation (prev, next, jump to page), page counter display, download button
- 19.3: Make viewer responsive on mobile, add keyboard shortcuts (arrow keys for pages), test smooth zoom functionality and various PDF sizes

**Acceptance Criteria:**

- [ ] PDF opens in full-screen viewer
- [ ] PDF renders clearly and readable
- [ ] Zoom in button increases PDF size
- [ ] Zoom out button decreases PDF size
- [ ] Fit to page button sizes PDF to screen
- [ ] Zoom percentage displayed
- [ ] Previous page button navigates backward
- [ ] Next page button navigates forward
- [ ] Page number input allows jumping to specific page
- [ ] Current page number and total pages displayed (e.g., "5 of 12")
- [ ] Download button downloads original PDF file
- [ ] Viewer works smoothly on mobile devices
- [ ] Touch gestures work for zoom on mobile
- [ ] Arrow keys navigate pages (keyboard shortcut)
- [ ] PDF scrolling smooth without lag

**Dependencies:** Parent #18

**Docs:**

- `/pdf-library-architecture.md` (@react-pdf-viewer section)

---

### Parent #20: Document Templates

**PR Goal:** Users can save and reuse document templates

**Child Tasks:**

- 20.1: Create `templates` table schema in Convex, add "Save as Template" button to documents, create save template mutation
- 20.2: Build template library page route, query templates for workspace, display templates in grid/list view with metadata (name, description)
- 20.3: Implement "Use Template" button, create duplicate template mutation, copy template as new document, test template duplication includes all fields

**Acceptance Criteria:**

- [ ] "Save as Template" button available on prepared documents
- [ ] Clicking "Save as Template" prompts for template name and description
- [ ] Template saves successfully with all signature fields preserved
- [ ] Template library page shows all saved templates
- [ ] Templates displayed in grid or list view
- [ ] Each template shows: name, description, thumbnail, created date
- [ ] "Use Template" button on each template
- [ ] Clicking "Use Template" creates new document from template
- [ ] New document includes all signature fields from template
- [ ] New document includes all field assignments from template
- [ ] Can edit template metadata (name, description)
- [ ] Can delete templates no longer needed

**Dependencies:** Parent #19

**Docs:**

- `/features/document-management/document-templates/feature-spec.md`
- `/features/document-management/document-templates/user-flows.md`
- `/features/document-management/document-templates/wireframes/01-template-interface.md`

---

## Layer 3: Signature Workflow

### Parent #21: Konva Canvas Setup

**PR Goal:** Canvas layer working over PDF for field placement

**Child Tasks:**

- 21.1: Install `konva` and `react-konva`, create canvas layer component, position canvas over PDF viewer
- 21.2: Sync canvas dimensions with PDF, handle zoom synchronization, create canvas for each PDF page (multi-page support)
- 21.3: Test coordinate system matches PDF pixels, handle window resize events

**Acceptance Criteria:**

- [ ] Interactive canvas layer appears over PDF viewer
- [ ] Canvas perfectly aligned with PDF pages
- [ ] Can interact with canvas without affecting PDF viewing
- [ ] Multi-page PDFs have canvas on each page
- [ ] Zooming PDF also zooms canvas (stays aligned)
- [ ] Panning PDF also pans canvas (stays aligned)
- [ ] Window resizing maintains canvas-PDF alignment
- [ ] No visible lag or misalignment during interaction
- [ ] Canvas ready for signature field placement

**Dependencies:** Parent #20

**Docs:**

- `/features/signature-workflow/document-preparation-interface/feature-spec.md`
- `/features/signature-workflow/document-preparation-interface/user-flows.md`
- `/features/signature-workflow/document-preparation-interface/wireframes/01-document-preparation-interface.md`
- `/pdf-library-architecture.md` (Konva section)
- `/docusign-oss-vision.md` (lines 80-84)

---

### Parent #22: Field Placement System

**PR Goal:** Users can drag signature fields onto PDF

**Child Tasks:**

- 22.1: Create field toolbar component with field type buttons (signature, text, date, checkbox), implement drag from toolbar to canvas
- 22.2: Add field drop handler on canvas, position field at correct coordinates, add field repositioning (drag after placement), add field resizing with handles
- 22.3: Save field coordinates to database immediately, load existing fields when opening document, add field delete functionality, test multi-page field placement

**Acceptance Criteria:**

- [ ] Field toolbar displays with field type buttons (Signature, Text, Date, Checkbox)
- [ ] Can drag field type from toolbar onto PDF
- [ ] Field drops at cursor location on PDF
- [ ] Field shows visual indicator when placed
- [ ] Can click and drag field to reposition
- [ ] Corner handles appear when field selected
- [ ] Dragging corner handles resizes field
- [ ] Field maintains aspect ratio when resizing (or freeform)
- [ ] Fields save automatically after placement/move/resize
- [ ] Closing and reopening document shows all fields in correct positions
- [ ] Delete button or keyboard shortcut removes selected field
- [ ] Can place multiple fields on same page
- [ ] Can place fields on all pages of multi-page document
- [ ] Field placement works smoothly on mobile (touch drag)

**Dependencies:** Parent #21

**Docs:**

- `/features/signature-workflow/signature-field-management/feature-spec.md`
- `/features/signature-workflow/signature-field-management/user-flows.md`
- `/features/signature-workflow/signature-field-management/wireframes/01-field-placement-interface.md`
- `/design-phase/interaction-patterns/drag-drop-patterns.md`

---

### Parent #23: Field Configuration Panel

**PR Goal:** Users can configure field properties

**Child Tasks:**

- 23.1: Create field properties side panel component, show panel when field is selected
- 23.2: Add field type selector dropdown, required/optional toggle, field label input, validation rules selector, placeholder text input (for text fields), field description/help text option
- 23.3: Save property changes immediately, update field appearance based on properties

**Acceptance Criteria:**

- [ ] Clicking a field opens properties panel (sidebar or modal)
- [ ] Panel shows current field configuration
- [ ] Field type dropdown allows changing type (Signature, Text, Date, Checkbox)
- [ ] Required/Optional toggle switch available
- [ ] Field label input allows custom text
- [ ] Validation rules selector for text fields (email, phone, number, etc.)
- [ ] Placeholder text input for text fields
- [ ] Help text/description field for additional context
- [ ] All changes save automatically to database
- [ ] Field visual appearance updates immediately when properties change
- [ ] Closing panel deselects field
- [ ] Panel works smoothly on mobile devices

**Dependencies:** Parent #22

**Docs:**

- `/features/signature-workflow/signature-field-management/feature-spec.md`
- `/features/signature-workflow/signature-field-management/user-flows.md`

---

### Parent #24: Recipient Management

**PR Goal:** Users can add recipients and assign fields to them

**Child Tasks:**

- 24.1: Create "Add Recipient" dialog component with form (name, email, role), create `recipients` table schema, create add recipient mutation
- 24.2: Display recipient list in sidebar, assign unique color to each recipient, show recipient field counts
- 24.3: Add field-to-recipient assignment dropdown, color-code fields by assigned recipient, add edit recipient functionality, add remove recipient functionality (unassign fields), test multiple recipients with overlapping fields

**Acceptance Criteria:**

- [ ] "Add Recipient" button opens dialog/form
- [ ] Form accepts: name, email, role (Signer, Viewer, Approver)
- [ ] Can add multiple recipients to document
- [ ] Each recipient assigned unique color automatically
- [ ] Recipient list shows all added recipients with their colors
- [ ] Each recipient shows count of fields assigned to them
- [ ] Clicking field shows dropdown to assign to recipient
- [ ] Fields visually color-coded by assigned recipient
- [ ] Unassigned fields shown in different color/style
- [ ] Can edit recipient information after adding
- [ ] Can remove recipient (their fields become unassigned)
- [ ] Recipient order determines signing order
- [ ] Can reorder recipients by dragging (if sequential signing)

**Dependencies:** Parent #23

**Docs:**

- `/features/signature-workflow/recipient-management/feature-spec.md`
- `/features/signature-workflow/recipient-management/user-flows.md`
- `/features/signature-workflow/recipient-management/wireframes/01-recipient-setup-interface.md`

---

### Parent #25: Embed Fields in PDF

**PR Goal:** Fields embedded in PDF using pdf-lib

**Child Tasks:**

- 25.1: Install `pdf-lib`, create function to convert canvas coordinates to PDF coordinates
- 25.2: Load original PDF with pdf-lib, create form fields in PDF at correct positions, set field properties (required, validation, etc.)
- 25.3: Generate interactive PDF with embedded fields, upload modified PDF to Convex storage, keep reference to original PDF, test PDF opens correctly in PDF viewers and interactive fields work

**Acceptance Criteria:**

- [ ] Signature fields embedded into PDF document
- [ ] Text fields embedded into PDF document
- [ ] Date fields embedded into PDF document
- [ ] Checkbox fields embedded into PDF document
- [ ] All fields positioned correctly matching canvas placement
- [ ] Modified PDF opens in standard PDF viewers (Adobe, Preview, etc.)
- [ ] Embedded fields are interactive in PDF viewers
- [ ] Field properties preserved (required, validation, labels)
- [ ] Original uploaded PDF preserved unchanged
- [ ] Modified PDF with fields saved as separate version
- [ ] Can download both original and field-embedded PDF

**Dependencies:** Parent #24

**Docs:**

- `/pdf-library-architecture.md` (PDF-lib section)
- `/docusign-oss-vision.md` (lines 74-75)

---

## Layer 4: Signature Workflow (Signing & Sending)

### Parent #26: Signature Capture Interface

**PR Goal:** Users can draw, type, or upload signatures

**Child Tasks:**

- 26.1: Install `react-signature-canvas`, create signature capture modal with three tabs (Draw, Type, Upload)
- 26.2: Implement draw signature with canvas (touch and mouse support), typed signature with font selection, uploaded signature with image validation (PNG/JPG only, file size limits)
- 26.3: Add signature preview, clear/redo functionality, save signature to Convex, create signature library for reuse

**Acceptance Criteria:**

- [ ] Signature modal opens when signature field clicked
- [ ] Three tabs available: Draw, Type, Upload
- [ ] **Draw tab:** Can draw signature with mouse
- [ ] **Draw tab:** Can draw signature with touch on mobile
- [ ] **Draw tab:** Clear button erases signature
- [ ] **Draw tab:** Redo button available
- [ ] **Type tab:** Text input for typing name
- [ ] **Type tab:** Font selector dropdown with multiple fonts
- [ ] **Type tab:** Live preview of typed signature
- [ ] **Upload tab:** File picker for image upload
- [ ] **Upload tab:** Only PNG/JPG files accepted
- [ ] **Upload tab:** File size limit enforced (5MB max)
- [ ] **Upload tab:** Image preview after upload
- [ ] Blank/empty signatures cannot be saved
- [ ] Preview shows signature before final save
- [ ] Save button adds signature to library
- [ ] Signature library shows all saved signatures
- [ ] Can select and reuse signatures from library
- [ ] Can delete signatures from library

**Dependencies:** Parent #25

**Docs:**

- `/features/signature-workflow/digital-signature-implementation/feature-spec.md`
- `/features/signature-workflow/digital-signature-implementation/user-flows.md`
- `/features/signature-workflow/digital-signature-implementation/wireframes/01-signature-creation-interface.md`
- `/docusign-oss-vision.md` (line 76)

---

### Parent #27: Digital Signature Implementation

**PR Goal:** Cryptographic signatures with Web Crypto API and audit trail

**Child Tasks:**

- 27.1: Implement Web Crypto API for document hashing (SHA-256), generate cryptographic signatures, create signature certificates
- 27.2: Build audit trail system to log signature events (creation timestamp, signer IP, device info, authentication method, signature hash)
- 27.3: Embed signatures in PDF with pdf-lib, ensure signature immutability, implement signature verification, test signature validity

**Acceptance Criteria:**

- [ ] Document hash generated when document uploaded
- [ ] Signature creates cryptographic hash
- [ ] Signature hash verifiable later
- [ ] Audit trail records: signer name, email, timestamp
- [ ] Audit trail records: IP address, device info
- [ ] Audit trail records: signature method used (draw/type/upload)
- [ ] Audit trail records: authentication method
- [ ] Signatures cannot be modified after signing
- [ ] Signed document immutable (tamper-proof)
- [ ] Can verify signature authenticity later
- [ ] Audit trail viewable by document sender
- [ ] Audit trail exportable for legal compliance
- [ ] All cryptographic operations use Web Crypto API

**Dependencies:** Parent #26

**Docs:**

- `/features/signature-workflow/digital-signature-implementation/feature-spec.md`
- `/features/authentication/security-compliance/feature-spec.md`
- `/pdf-library-architecture.md` (Signing Flow section)
- `/docusign-oss-vision.md` (line 86)

---

### Parent #28: Signing Experience

**PR Goal:** Recipients can sign documents with mobile-friendly interface

**Child Tasks:**

- 28.1: Create signer document view with PDF display, build field navigation system (next/previous field, auto-scroll to fields), add progress indicators (page X of Y, field completion percentage, progress bar)
- 28.2: Implement field completion workflow (highlight current field, validate field inputs in real-time, required field enforcement, auto-save field inputs to Convex)
- 28.3: Build completion screen with document download, email delivery, completion certificate generation, implement session recovery (resume signing after browser close, handle network interruptions, save progress continuously)
- 28.4: Optimize for mobile (touch-friendly interface, responsive design 320px+, virtual keyboard handling, portrait and landscape orientation support), test on iOS Safari and Android Chrome

**Acceptance Criteria:**
**Document Viewing & Navigation:**

- [ ] PDF displays correctly for recipient
- [ ] Page indicators show "Page X of Y"
- [ ] Field completion status tracked in real-time
- [ ] Progress percentage displays (e.g., "75% complete")
- [ ] Progress bar visualizes completion
- [ ] "Next Field" button navigates to next unfilled field
- [ ] "Previous Field" button navigates to previous field
- [ ] Auto-scroll brings current field into view
- [ ] Current field highlighted with visual indicator
- [ ] Remaining fields shown in different color

**Field Completion:**

- [ ] Text fields accept typed input
- [ ] Signature fields open signature capture modal
- [ ] Date fields provide date picker
- [ ] Checkbox fields toggle on click
- [ ] Field validation runs in real-time
- [ ] Invalid fields show error messages
- [ ] Required field enforcement prevents submission
- [ ] Field inputs auto-save to Convex after each entry
- [ ] "Complete" button disabled until all required fields filled

**Session Recovery:**

- [ ] Browser close saves all progress to Convex
- [ ] Returning users see "Resume Signing" option
- [ ] Restored session shows completed vs. remaining fields
- [ ] Network interruption queues inputs locally
- [ ] Connection restored syncs queued inputs
- [ ] "Connection Lost" message displays during outage
- [ ] "Try Again" and "Save Progress" buttons available

**Completion Flow:**

- [ ] Completion confirmation screen displays
- [ ] Signed document available for download
- [ ] Download button works correctly
- [ ] Completion email sent to recipient
- [ ] Completion certificate generated with audit trail
- [ ] Thank you message customizable by sender

**Mobile Optimization:**

- [ ] Responsive design from 320px+ screen sizes
- [ ] Touch-friendly interface elements (44px+ tap targets)
- [ ] Signature capture optimized for touch
- [ ] Virtual keyboard handling doesn't break layout
- [ ] Works in portrait and landscape orientation
- [ ] State preserved during device rotation
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] Fast performance on mobile connections

**Error Recovery:**

- [ ] Document deleted during signing shows graceful error
- [ ] Document modifications detected and user notified
- [ ] Signature capture failures offer alternative methods
- [ ] PDF processing errors show clear recovery steps

**Dependencies:** Parent #27

**Docs:**

- `/features/signature-workflow/signing-experience/feature-spec.md`
- `/features/signature-workflow/signing-experience/user-flows.md`
- `/features/signature-workflow/signing-experience/wireframes/01-signing-interface.md`
- `/features/signature-workflow/signing-experience/wireframes/02-mobile-signature-capture.md`
- `/design-phase/ui-specifications/responsive-breakpoints.md`

---

### Parent #29: Document Sending Flow

**PR Goal:** Users can review and send documents to recipients

**Child Tasks:**

- 29.1: Create document sending page with final document preview, recipient review list, field assignment verification
- 29.2: Build custom message composer for each recipient, add message templates, implement email validation, add sending deadline picker (optional)
- 29.3: Implement send document mutation (update status to "sent", generate signing links for each recipient, save sending metadata), show sending confirmation screen with delivery tracking preview

**Acceptance Criteria:**

- [ ] Document sending page shows full document preview
- [ ] Recipient list displayed with all assigned fields
- [ ] Field assignment verification visible (all fields assigned)
- [ ] Custom message composer available for each recipient
- [ ] Message templates available for quick selection
- [ ] Email addresses validated before sending
- [ ] Optional deadline picker allows setting signing deadline
- [ ] Deadline date/time displayed clearly
- [ ] "Send Document" button prominent and clear
- [ ] Clicking Send triggers email delivery to all recipients
- [ ] Confirmation screen displays after successful send
- [ ] Confirmation shows list of recipients who received email
- [ ] Document status changes from "Draft" to "Sent"
- [ ] Unique signing link generated for each recipient
- [ ] Cannot send document with unassigned fields
- [ ] Cannot send document without recipients

**Dependencies:** Parent #28

**Docs:**

- `/features/signature-workflow/document-sending/feature-spec.md`
- `/features/signature-workflow/document-sending/user-flows.md`
- `/features/signature-workflow/document-sending/wireframes/01-document-sending-interface.md`
- `/design-phase/interaction-patterns/form-patterns.md`

---

### Parent #30: Email Templates & Delivery

**PR Goal:** Email system working with Resend and React Email templates

**Child Tasks:**

- 30.1: Setup Resend account and configure API keys, install React Email and create email template structure
- 30.2: Build email templates using React Email (document invitation, reminder email, document completed, welcome email, team invitation), add custom message interpolation, make templates responsive
- 30.3: Implement email sending from Convex mutations (send invitation on document send, send completion notification, send reminder emails), add email delivery tracking (delivered, opened, bounced status), implement retry logic for failed deliveries

**Acceptance Criteria:**
**Resend Setup:**

- [ ] Resend account created and API key configured
- [ ] React Email installed and template structure created
- [ ] Email sending domain verified
- [ ] Test emails send successfully from development
- [ ] Production email sending configured

**Email Templates:**

- [ ] Document invitation template: Professional design with signing link
- [ ] Reminder template: Polite nudge with document details
- [ ] Completion template: Thank you message with download link
- [ ] Welcome email template: Onboarding for new users
- [ ] Team invitation template: Workspace invitation with accept link
- [ ] All templates mobile-responsive
- [ ] All templates include custom message interpolation
- [ ] Templates match Seal brand guidelines
- [ ] Unsubscribe links included where required

**Email Delivery:**

- [ ] Invitation emails send immediately when document sent
- [ ] Signing links generated uniquely per recipient
- [ ] Signing links expire after configurable period
- [ ] Custom messages from sender included in emails
- [ ] Completion notification triggers when all signatures collected
- [ ] Sender receives completion email with signed PDF
- [ ] Welcome email sends on user sign-up
- [ ] Team invitations send when member added

**Delivery Tracking:**

- [ ] Email delivery status tracked (sent, delivered, opened, bounced)
- [ ] Opened status tracked via tracking pixels
- [ ] Bounce detection working
- [ ] Delivery failures logged to database
- [ ] Sender notified of bounced emails
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Failed deliveries marked as "failed" after max retries

**Reminder System:**

- [ ] Manual reminder button available to sender
- [ ] Manual reminders send immediately on click
- [ ] Reminder count tracked per recipient
- [ ] Reminder emails include time since original send
- [ ] Maximum reminders configurable (default: 3)

**Error Handling:**

- [ ] Invalid email addresses caught before sending
- [ ] Malformed emails show validation error
- [ ] API errors logged and reported
- [ ] Rate limiting respected (Resend limits)
- [ ] Temporary failures trigger retry
- [ ] Permanent failures notify sender with actionable message

**Dependencies:** Parent #29

**Docs:**

- `/features/communications/email-integration/feature-spec.md`
- `/features/communications/email-integration/user-flows.md`
- `/features/communications/email-integration/wireframes/01-email-compose-interface.md`
- `/features/communications/email-integration/wireframes/01-email-compose-and-send.md`
- `/docusign-oss-vision.md` (lines 77-78)

---

### Parent #31: Document Status Tracking

**PR Goal:** Real-time status tracking and notifications

**Child Tasks:**

- 31.1: Create document status schema (draft, sent, in_progress, completed, cancelled), implement status transition logic with validation, build status dashboard showing document list with status badges
- 31.2: Implement recipient tracking (viewed timestamp, signed timestamp, declined tracking), calculate completion percentage, build activity feed showing document history, add real-time status updates via Convex subscriptions
- 31.3: Build reminder system (manual reminder sending, automated reminder scheduling, reminder tracking), implement expiration date enforcement, add cancellation functionality with recipient notifications, create toast notifications for status changes

**Acceptance Criteria:**

- [ ] Document status displayed prominently: Draft, Sent, In Progress, Completed, Cancelled
- [ ] Status badge shows current state with color coding
- [ ] Status transitions happen automatically (Sent → In Progress when first signature)
- [ ] Recipient tracking shows: Viewed timestamp, Signed timestamp, Declined status
- [ ] Completion percentage calculates based on signatures collected
- [ ] Progress bar visualizes completion (e.g., "2 of 3 signed")
- [ ] Activity feed shows chronological document history
- [ ] Activity feed shows: document sent, viewed by recipient, signed by recipient, completed
- [ ] Real-time updates: sender sees status changes without refresh
- [ ] "Send Reminder" button available for pending recipients
- [ ] Manual reminders send immediately via email
- [ ] Automated reminders schedule based on settings
- [ ] Reminder tracking shows when last reminder sent
- [ ] Document expiration enforced based on deadline
- [ ] "Cancel Document" button available for sent documents
- [ ] Cancellation sends notification to all pending recipients
- [ ] Toast notifications appear for: document viewed, signature received, document completed
- [ ] Notification preferences respected (can be turned off)

**Dependencies:** Parent #30

**Docs:**

- `/features/signature-workflow/document-status-tracking/feature-spec.md`
- `/features/signature-workflow/document-status-tracking/user-flows.md`
- `/features/signature-workflow/document-status-tracking/wireframes/01-status-tracking-interface.md`
- `/design-phase/state-documentation-patterns.md`
- `/design-phase/interaction-patterns/notifications.md`

---

## Layer 5: User Experience

### Parent #32: Sender Dashboard

**PR Goal:** Dashboard with stats, recent documents, and analytics

**Child Tasks:**

- 32.1: Create dashboard page layout, build stats cards showing document counts (pending, completed, declined, total), add document volume trend charts using recharts, calculate completion rate analytics
- 32.2: Build recent documents list with sorting and filtering, create activity timeline showing recent actions, add quick actions (upload new document, filter by status, search documents)
- 32.3: Add workspace switcher dropdown, implement export functionality (CSV, PDF reports), make dashboard responsive for mobile

**Acceptance Criteria:**

- [ ] Dashboard displays upon login
- [ ] Stats cards show: Total documents, Pending signatures, Completed documents, Declined documents
- [ ] Stats update in real-time as documents change status
- [ ] Document volume trend chart shows activity over time
- [ ] Chart displays data for last 30 days
- [ ] Completion rate percentage calculated and displayed
- [ ] Recent documents list shows last 10 documents with status
- [ ] Activity timeline shows recent workspace actions
- [ ] "Upload New Document" quick action button prominent
- [ ] Filter dropdown allows filtering by status
- [ ] Search box searches documents quickly
- [ ] Workspace switcher dropdown accessible from header
- [ ] Export button generates CSV report of documents
- [ ] Export button generates PDF summary report
- [ ] Dashboard layout responsive on mobile devices
- [ ] All elements accessible and functional on small screens

**Dependencies:** Parent #31

**Docs:**

- `/features/dashboards-analytics/sender-dashboard/feature-spec.md`
- `/features/dashboards-analytics/sender-dashboard/user-flows.md`
- `/features/dashboards-analytics/sender-dashboard/wireframes/01-sender-dashboard-interface.md`
- `/design-phase/information-architecture/navigation-structure.md`

---

### Parent #33: Mobile Optimization

**PR Goal:** Complete app optimized for mobile devices

**Child Tasks:**

- 33.1: Audit all pages for responsive design (320px to 1920px breakpoints), increase touch targets to minimum 44px, optimize mobile navigation and menus
- 33.2: Optimize signing experience for mobile (touch-optimized signature canvas, mobile PDF navigation, larger field targets, virtual keyboard handling, orientation change handling)
- 33.3: Performance optimization for mobile (bundle size reduction, lazy loading, image optimization), test on iOS Safari and Android Chrome, test on slow 3G connections

**Acceptance Criteria:**

- [ ] All pages work correctly from 320px (small phone) to 1920px (desktop)
- [ ] All buttons and clickable elements minimum 44px touch target
- [ ] Mobile navigation accessible via hamburger menu
- [ ] Navigation menu slides in/out smoothly
- [ ] Forms work correctly with virtual keyboard
- [ ] Virtual keyboard doesn't cover input fields
- [ ] Layout doesn't break when keyboard appears
- [ ] Signature canvas optimized for touch
- [ ] Touch drawing feels smooth and responsive
- [ ] PDF viewer works well on small screens
- [ ] Pinch to zoom works on mobile PDF viewer
- [ ] Field placement works with touch drag
- [ ] Portrait and landscape orientations both supported
- [ ] Orientation change doesn't lose data or break layout
- [ ] Page loads quickly on 3G connection
- [ ] Images and assets optimized for mobile
- [ ] Tested on iOS Safari (iPhone)
- [ ] Tested on Android Chrome (Android phone)
- [ ] No horizontal scrolling on mobile
- [ ] Text readable without zooming

**Dependencies:** Parent #32

**Docs:**

- `/design-phase/ui-specifications/responsive-breakpoints.md`
- `/features/signature-workflow/signing-experience/wireframes/02-mobile-signature-capture.md`
- `/design-phase/component-interactions.md`

---

### Parent #34: Onboarding & Landing Page

**PR Goal:** New user onboarding and marketing landing page

**Child Tasks:**

- 34.1: Build marketing landing page (hero section, features showcase, pricing display, CTAs, footer), make landing page responsive and optimized
- 34.2: Create welcome tour for new users (product walkthrough, feature highlights, sample documents), build quick-start checklist, add contextual help tooltips throughout app
- 34.3: Implement empty states with helpful CTAs (no documents, no templates, no team members), add notification preferences UI, create sample templates for new users

**Acceptance Criteria:**
**Landing Page:**

- [ ] Hero section displays with compelling headline
- [ ] Clear call-to-action button ("Get Started Free")
- [ ] Features section showcases key product benefits
- [ ] Pricing section shows Free and Pro tiers clearly
- [ ] Footer includes links to docs, support, social media
- [ ] Landing page fully responsive on all devices
- [ ] Loading speed optimized (<2s)
- [ ] All links functional

**New User Onboarding:**

- [ ] First login triggers welcome tour
- [ ] Tour highlights: Upload document, Add fields, Send for signing
- [ ] Tour can be skipped or completed
- [ ] Quick-start checklist appears on dashboard
- [ ] Checklist items: Upload first document, Send first document, Invite team member
- [ ] Completed checklist items check off automatically
- [ ] Contextual help tooltips throughout app
- [ ] Tooltips explain features on hover/click

**Empty States:**

- [ ] "No documents" state shows helpful message and upload button
- [ ] "No templates" state shows helpful message and create button
- [ ] "No team members" state shows helpful message and invite button
- [ ] All empty states visually appealing and encouraging

**Sample Content:**

- [ ] New workspaces get 2-3 sample document templates
- [ ] Sample templates demonstrate common use cases
- [ ] Sample templates can be used or deleted

**Dependencies:** Parent #33

**Docs:**

- `/features/workspace-management/landing-onboarding/feature-spec.md`
- `/features/workspace-management/landing-onboarding/user-flows.md`
- `/features/workspace-management/landing-onboarding/wireframes/01-hero-landing-page.md`
- `/features/workspace-management/landing-onboarding/wireframes/02-onboarding-flow.md`
- `/features/workspace-management/landing-onboarding/wireframes/03-interactive-demo.md`
- `/features/authentication/user-profile/wireframes/02-notification-preferences.md`
- `/design-phase/interaction-patterns/notifications.md`

---

### Parent #35: Team Collaboration

**PR Goal:** Team management with invitations, roles, and document sharing

**Child Tasks:**

- 35.1: Build team management page with member list, invite flow, and role assignment UI
- 35.2: Implement team invitation system (email invites, accept/decline flow, invitation expiration)
- 35.3: Create role-based permissions system (Owner, Admin, Member, Viewer roles), enforce permissions across app
- 35.4: Implement document sharing within team (share dialog, permission levels, activity tracking)

**Acceptance Criteria:**
**Team Management Page:**

- [ ] Team management page accessible from workspace settings
- [ ] Member list displays all workspace members
- [ ] Each member shows: name, email, role, join date
- [ ] "Invite Member" button prominent
- [ ] Can filter members by role
- [ ] Can search members by name/email
- [ ] Owner can change member roles
- [ ] Owner can remove members from workspace

**Team Invitations:**

- [ ] Invite modal accepts email addresses
- [ ] Can select role for invitee (Admin, Member, Viewer)
- [ ] Invitation email sent via Resend
- [ ] Email includes workspace name and inviter name
- [ ] Email contains accept/decline links
- [ ] Accept link adds user to workspace
- [ ] Decline link removes pending invitation
- [ ] Pending invitations shown in team page
- [ ] Can resend invitations
- [ ] Can cancel pending invitations
- [ ] Invitations expire after 7 days
- [ ] Expired invitations automatically removed

**Role-Based Permissions:**

- [ ] Owner role: Full workspace control, can delete workspace
- [ ] Admin role: Manage members, documents, settings
- [ ] Member role: Create and send documents, limited settings
- [ ] Viewer role: View documents only, no editing
- [ ] Permissions matrix documented and enforced
- [ ] Permission checks on all mutations
- [ ] Unauthorized actions show permission error
- [ ] Role badges displayed throughout app
- [ ] Only Owner can change Owner role
- [ ] Workspace must always have at least one Owner

**Document Sharing:**

- [ ] "Share" button on documents
- [ ] Share dialog shows workspace members
- [ ] Can select members to share with
- [ ] Permission level selector (View, Edit, Owner)
- [ ] View permission: Can view document only
- [ ] Edit permission: Can edit and send document
- [ ] Owner permission: Full control including deletion
- [ ] Shared members list visible on document
- [ ] Can remove shared access
- [ ] Activity log shows sharing events
- [ ] Notifications sent when document shared
- [ ] Shared documents appear in recipient's library

**Team Activity Tracking:**

- [ ] Team activity feed shows member actions
- [ ] Activity types: Member joined, Member invited, Document shared, Role changed
- [ ] Activity feed filterable by member
- [ ] Activity feed filterable by action type
- [ ] Activity timestamps accurate
- [ ] Activity feed paginated

**Dependencies:** Parent #34

**Docs:**

- `/features/workspace-management/team-collaboration/feature-spec.md`
- `/features/workspace-management/team-collaboration/user-flows.md`
- `/features/workspace-management/team-collaboration/wireframes/01-team-management.md`
- `/features/workspace-management/team-collaboration/wireframes/02-document-sharing.md`
- `/design-phase/information-architecture/user-permissions-matrix.md`

---

## Layer 6: Business Integration

### Parent #36: Public REST API

**PR Goal:** Developer API with authentication and documentation

**Child Tasks:**

- 36.1: Setup API route infrastructure in Convex, implement API key authentication via Clerk, add rate limiting middleware, implement API versioning (v1)
- 36.2: Build core API endpoints (POST /v1/documents/upload, POST /v1/documents/send, GET /v1/documents/:id, GET /v1/documents, POST /v1/webhooks), add request validation with Zod, implement proper error responses
- 36.3: Create API documentation site with multi-language code examples (cURL, JavaScript, Python, Go, Ruby), build interactive API explorer, write authentication guide and getting started docs

**Acceptance Criteria:**
**API Infrastructure:**

- [ ] Convex HTTP Actions configured and deployed
- [ ] API endpoints accessible at `https://{deployment}.convex.site`
- [ ] API versioning implemented (v1 prefix)
- [ ] CORS configured for browser requests
- [ ] Request/response logging enabled

**Authentication:**

- [ ] Clerk API key generation working
- [ ] API keys generated with custom prefix (e.g., "seal\_")
- [ ] API key validation on every request
- [ ] Workspace-scoped API key permissions enforced
- [ ] Invalid API keys return 401 with clear message
- [ ] Expired API keys rejected with actionable error
- [ ] API keys inherit user role permissions (RBAC)

**Rate Limiting:**

- [ ] Rate limiting configured per API key
- [ ] Default: 100 requests per minute per key
- [ ] Rate limit headers returned (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- [ ] Rate limit exceeded returns 429 with retry-after header
- [ ] Pro plan workspaces get higher limits

**Core Endpoints:**

- [ ] POST /v1/documents/upload - Upload document via API
- [ ] POST /v1/documents/send - Send document for signing
- [ ] GET /v1/documents/:id - Get document details and status
- [ ] GET /v1/documents - List workspace documents (paginated)
- [ ] POST /v1/webhooks - Register webhook endpoint
- [ ] All endpoints validate requests with Zod schemas
- [ ] Validation errors return 400 with detailed field errors

**Error Handling:**

- [ ] 401 Unauthorized: Invalid or missing API key
- [ ] 403 Forbidden: Insufficient permissions for resource
- [ ] 404 Not Found: Resource doesn't exist or not accessible
- [ ] 422 Unprocessable Entity: Validation errors with details
- [ ] 429 Too Many Requests: Rate limit exceeded
- [ ] 500 Internal Server Error: Logged with error ID
- [ ] All errors return consistent JSON format

**API Documentation:**

- [ ] Documentation site deployed and accessible
- [ ] Getting started guide with authentication setup
- [ ] API reference for all endpoints
- [ ] Code examples in cURL, JavaScript, Python, Go, Ruby
- [ ] Request/response examples for each endpoint
- [ ] Error response documentation
- [ ] Rate limiting documentation
- [ ] Webhook integration guide
- [ ] Interactive API explorer (try endpoints with API key)
- [ ] Postman collection available for download

**Developer Experience:**

- [ ] API keys manageable from dashboard
- [ ] API usage metrics displayed (requests, errors, rate limits)
- [ ] Logs available for debugging
- [ ] Test mode available (sandbox environment)

**Dependencies:** Parent #35

**Docs:**

- `/features/developer-api/external-api-integration/feature-spec.md`
- `/features/developer-api/external-api-integration/user-flows.md`
- `/features/developer-api/external-api-integration/wireframes/01-api-integration-interface.md`
- `/features/developer-api/developer-experience/feature-spec.md`
- `/features/developer-api/developer-experience/user-flows.md`
- `/features/developer-api/developer-experience/wireframes/01-developer-portal-interface.md`
- `/docusign-oss-vision.md` (lines 218-236)

---

### Parent #37: Webhooks System

**PR Goal:** Webhook delivery system with retry logic

**Child Tasks:**

- 37.1: Create webhooks schema in Convex (url, events, secret, enabled status), build webhook registration UI (add webhook, configure events, generate secret, test endpoint)
- 37.2: Implement webhook delivery queue with exponential backoff retry logic, add webhook signature generation for verification, create webhook event triggers (document.sent, document.viewed, document.completed, document.declined, document.expired)
- 37.3: Build webhook management dashboard (view registered webhooks, delivery logs, enable/disable webhooks, test webhook delivery), add webhook delivery status tracking

**Acceptance Criteria:**
**Webhook Registration:**

- [ ] Webhook settings page accessible from dashboard
- [ ] "Add Webhook" button opens registration form
- [ ] Form accepts: Webhook URL, description
- [ ] Event selector allows choosing which events to subscribe to
- [ ] Events available: document.sent, document.viewed, document.signed, document.completed, document.declined, document.expired
- [ ] Webhook secret automatically generated on creation
- [ ] Secret displayed once (copy-able) and then hidden
- [ ] Test endpoint button sends test payload
- [ ] Test shows success/failure result

**Webhook Delivery:**

- [ ] Webhooks fire immediately when events occur
- [ ] Payload includes: event type, document ID, timestamp, relevant data
- [ ] Payload signed with webhook secret for verification
- [ ] HTTP POST sent to registered URL
- [ ] Delivery timeout after 30 seconds
- [ ] Failed deliveries automatically retry
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] Permanent failures marked after max retries

**Webhook Management:**

- [ ] Dashboard shows all registered webhooks
- [ ] Each webhook shows: URL, events, status (active/inactive)
- [ ] Delivery logs accessible per webhook
- [ ] Logs show: timestamp, event, status (success/failed), response code
- [ ] Can view payload and response for each delivery
- [ ] Enable/disable toggle for webhooks
- [ ] Disabled webhooks don't receive events
- [ ] Can edit webhook URL and events
- [ ] Can delete webhooks permanently
- [ ] Webhook secret can be regenerated

**Dependencies:** Parent #36

**Docs:**

- `/features/developer-api/external-api-integration/feature-spec.md`
- `/features/developer-api/external-api-integration/user-flows.md`
- `/future-work.md` (lines 40-46)

---

## Layer 7: Quality & Launch

### Parent #38: Testing Suite

**PR Goal:** Comprehensive test coverage for MVP

**Child Tasks:**

- 38.1: Setup Vitest for unit tests, write unit tests for Convex functions (auth, documents, signatures, status), write unit tests for React components (forms, modals, dashboards), achieve >80% code coverage
- 38.2: Write integration tests (auth flow end-to-end, document upload → send → sign → complete, API endpoint tests, webhook delivery tests, payment subscription tests)
- 38.3: Setup Playwright for E2E tests, write critical user journey tests (sign up new user, upload and send document, sign document as recipient, manage subscription), add performance tests (page load <2s, large PDF handling, database query optimization, 100 concurrent users load test)

**Acceptance Criteria:**
**Unit Testing:**

- [ ] Vitest installed and configured
- [ ] All Convex functions have unit tests
- [ ] All critical React components have tests
- [ ] Form validation logic tested
- [ ] Helper functions and utilities tested
- [ ] Test coverage report generated
- [ ] Code coverage exceeds 80%

**Integration Testing:**

- [ ] Auth flow tested end-to-end (sign up → verify → workspace creation)
- [ ] Document workflow tested (upload → prepare → send → sign → complete)
- [ ] API endpoints tested with various inputs
- [ ] Webhook delivery tested
- [ ] Payment subscription flow tested
- [ ] All integration tests passing

**End-to-End Testing:**

- [ ] Playwright installed and configured
- [ ] User journey: New user signs up and creates workspace
- [ ] User journey: Upload document, add fields, send for signature
- [ ] User journey: Recipient signs document
- [ ] User journey: Manage subscription and billing
- [ ] E2E tests run in CI/CD pipeline
- [ ] All E2E tests passing reliably

**Performance Testing:**

- [ ] Homepage loads in under 2 seconds
- [ ] Dashboard loads in under 2 seconds
- [ ] PDF viewer opens large PDFs (<10MB) smoothly
- [ ] Document list handles 1000+ documents without lag
- [ ] Database queries optimized (no N+1 queries)
- [ ] Load test: 100 concurrent users handled successfully
- [ ] No memory leaks detected
- [ ] Bundle size optimized and code-split

**Dependencies:** Parent #37

**Docs:**

- `/docusign-oss-vision.md` (lines 109-113)
- `/future-work.md` (lines 207-212)
- `/mvp-gameplan-structure.md` (lines 107-118)

---

### Parent #39: Security & Compliance

**PR Goal:** Security audit and ESIGN Act compliance verified

**Child Tasks:**

- 39.1: Run security scanning (npm audit, Snyk), perform auth vulnerability testing (CSRF, XSS), audit file upload security, review API security, verify rate limiting works
- 39.2: Implement ESIGN Act compliance (intent to sign capture, consent to electronic business modal, opt-out option for manual signing, signed copies distribution via email, record retention with 5-7 year storage)
- 39.3: Build audit trail completeness verification, ensure document immutability after signing, verify data encryption at rest and in transit, create compliance audit dashboard

**Acceptance Criteria:**
**Security Scanning:**

- [ ] npm audit run with no critical vulnerabilities
- [ ] Snyk scan completed with no high/critical issues
- [ ] Dependencies up to date with security patches
- [ ] All third-party libraries vetted for security

**Authentication Security:**

- [ ] CSRF protection enabled on all forms
- [ ] XSS vulnerabilities tested and mitigated
- [ ] SQL injection tests passed (Convex protects against this)
- [ ] Session hijacking prevention verified
- [ ] Clerk security features properly configured
- [ ] MFA available for high-security workspaces

**File Upload Security:**

- [ ] File type validation on client and server
- [ ] File size limits enforced (50MB max)
- [ ] Malicious file upload prevention tested
- [ ] Uploaded files scanned for malware (if possible)
- [ ] File storage isolated per workspace
- [ ] Access controls prevent unauthorized file access

**API Security:**

- [ ] API key authentication working correctly
- [ ] API keys stored securely (hashed)
- [ ] Rate limiting active on all endpoints
- [ ] API endpoints validate all inputs with Zod
- [ ] CORS properly configured
- [ ] API errors don't leak sensitive information

**ESIGN Act Compliance:**

- [ ] Intent to sign captured with explicit user action
- [ ] Clear "I agree to sign electronically" button
- [ ] Signature method recorded (draw, type, upload)
- [ ] Consent modal displays before first signature
- [ ] Consent confirmation stored with user ID and timestamp
- [ ] Electronic consent text complies with ESIGN Act
- [ ] Opt-out option available: "Sign manually instead"
- [ ] Manual signing workflow exists as alternative
- [ ] Signed copies distributed automatically via email
- [ ] Download links generated for all signers
- [ ] Document delivery tracked and logged

**Record Retention:**

- [ ] Signed documents stored for minimum 7 years
- [ ] Document storage encrypted at rest
- [ ] Backup system in place for disaster recovery
- [ ] Document retrieval process for legal requests
- [ ] Deletion policy enforced after retention period
- [ ] Workspace deletion preserves legal documents

**Audit Trail:**

- [ ] Document lifecycle events logged (upload, send, sign, complete)
- [ ] All logs include: timestamp, user ID, IP address, action type
- [ ] Signer activity tracked: email, auth method, time spent
- [ ] Failed signature attempts logged
- [ ] Audit logs immutable (cannot be edited or deleted)
- [ ] Audit trail export available (CSV, PDF)
- [ ] Audit logs searchable by document, user, date range
- [ ] Hash verification logged for document integrity

**Document Integrity:**

- [ ] SHA-256 hash generated on document upload (Web Crypto API)
- [ ] Document hash stored in database
- [ ] Hash verified before signing process
- [ ] Final signed document hash generated and stored
- [ ] Hash mismatch detection triggers security alert
- [ ] Tampered documents blocked from signing

**Data Encryption:**

- [ ] Data encrypted in transit (HTTPS everywhere)
- [ ] Data encrypted at rest (Convex encryption)
- [ ] Signing links encrypted and time-limited
- [ ] API keys stored hashed
- [ ] Sensitive logs encrypted

**Compliance Dashboard:**

- [ ] Audit dashboard accessible to workspace admins
- [ ] Document compliance status visible
- [ ] Audit trail browsing interface
- [ ] Compliance reports downloadable
- [ ] Security incidents displayed and tracked
- [ ] ESIGN compliance status per document

**Dependencies:** Parent #38

**Docs:**

- `/features/authentication/security-compliance/feature-spec.md`
- `/features/authentication/security-compliance/user-flows.md`
- `/features/authentication/security-compliance/wireframes/01-electronic-consent.md`
- `/features/authentication/security-compliance/wireframes/02-security-alerts.md`
- `/features/authentication/security-compliance/wireframes/03-audit-dashboard.md`
- `/features/compliance-audit/feature-spec.md`
- `/features/compliance-audit/user-flows.md`
- `/features/compliance-audit/wireframes/01-audit-trail-interface.md`
- `/compliance-implementation-checklist.md`
- `/future-work.md` (lines 250-265)

---

### Parent #40: Production Deployment

**PR Goal:** App deployed to production and stable

**Child Tasks:**

- 40.1: Setup production Convex deployment with environment variables, configure production Clerk app with OAuth providers, setup production retired provider account with real products
- 40.2: Deploy frontend to Vercel production, configure custom domain and SSL
- 40.3: Run production smoke tests (auth flow, document upload, signing flow, payment flow, API endpoints, webhooks), configure production environment variables across all services

**Acceptance Criteria:**
**Backend Deployment:**

- [ ] Convex production deployment created
- [ ] Production environment variables configured
- [ ] Production database migrated and ready
- [ ] Convex functions deployed successfully
- [ ] Convex dashboard accessible for monitoring

**Frontend Deployment:**

- [ ] Vercel project configured
- [ ] Production build successful
- [ ] Frontend deployed to Vercel
- [ ] Custom domain connected (e.g., seal.io)
- [ ] SSL certificate active and verified
- [ ] DNS configured correctly

**Third-Party Services:**

- [ ] Clerk production app created
- [ ] Clerk OAuth providers configured (Google, Microsoft, Apple)
- [ ] OAuth flows tested in production
- [ ] retired provider production account activated
- [ ] retired provider products and prices configured
- [ ] Payment flow tested in production
- [ ] Resend production account configured
- [ ] Email sending tested in production

**Logging:**

- [ ] Error alerts configured
- [ ] Production logs accessible

**Smoke Testing:**

- [ ] User can sign up successfully
- [ ] User can upload document successfully
- [ ] User can send document successfully
- [ ] Recipient can sign document successfully
- [ ] API endpoints responding correctly
- [ ] Webhooks delivering successfully
- [ ] No critical errors in logs
- [ ] Application stable and performant

**Dependencies:** Parent #39

**Docs:**

- `/docusign-oss-vision.md` (lines 62-65, 90-92)
- `/docusign-oss-vision.md` (lines 33-40)

---

### Parent #41: Launch Prep

**PR Goal:** Marketing materials and documentation ready for launch

**Child Tasks:**

- 41.1: Finalize marketing landing page with demo videos, write user documentation (getting started guide, features overview, FAQs), write developer documentation (API reference, integration guides, webhooks guide)
- 41.2: Prepare GitHub repository for open source (clean README, contribution guidelines, license, issue templates), setup support email and help desk
- 41.3: Draft launch announcements (Product Hunt post, HackerNews post, Twitter thread, blog post), prepare demo accounts and sample data, create launch checklist and go-live plan

**Acceptance Criteria:**
**Marketing Materials:**

- [ ] Landing page copy finalized and compelling
- [ ] Demo video recorded showing key features
- [ ] Demo video embedded on landing page
- [ ] Screenshots updated and high-quality
- [ ] Call-to-action buttons optimized
- [ ] SEO metadata configured (title, description, Open Graph)

**Documentation:**

- [ ] Getting started guide written (for end users)
- [ ] Features overview documented
- [ ] FAQ page created answering common questions
- [ ] API reference documentation complete
- [ ] Integration guides written (webhooks, API usage)
- [ ] Multi-language code examples provided
- [ ] Troubleshooting guide available

**Open Source Preparation:**

- [ ] GitHub repository cleaned and organized
- [ ] README.md compelling and thorough
- [ ] Contribution guidelines (CONTRIBUTING.md) written
- [ ] License file added (MIT or Apache 2.0)
- [ ] Issue templates created
- [ ] Pull request template created
- [ ] Code of conduct added
- [ ] Security policy documented

**Support Infrastructure:**

- [ ] Support email configured and monitored
- [ ] Help desk or ticketing system setup
- [ ] Community guidelines published
- [ ] Response time SLA defined

**Launch Announcements:**

- [ ] Product Hunt post drafted and ready
- [ ] Hacker News Show HN post drafted
- [ ] Twitter launch thread written
- [ ] Blog post announcing launch written
- [ ] Email to beta users drafted

**Pre-Launch Preparation:**

- [ ] 5-10 demo accounts created for testing
- [ ] Sample data loaded in demo accounts
- [ ] Launch checklist verified complete
- [ ] Team briefed on launch plan
- [ ] Monitoring alerts configured
- [ ] Support team ready
- [ ] Ready to announce publicly

**Dependencies:** Parent #40

**Docs:**

- `/docusign-oss-vision.md` (lines 206-286)
- `/docusign-oss-vision.md` (lines 171-189, 191-195, 260-275, 197-203)
- `/competitor-analysis.md`
- `/docusign-oss-vision.md` (lines 122-131, 133-154, 156-169)

---

**Total: 41 parent tasks covering all MVP features with complete documentation coverage**
