# Seal Development Roadmap

**What We're Building and In What Order**

This roadmap maps build sequence to existing documentation. Each deliverable references feature specs, wireframes, and user flows that contain the detailed requirements.

---

## Implementation Status (Updated 2026-02-18)

| # | Deliverable | Status | Notes |
|---|---|---|---|
| **Foundation Layer** | | | |
| 1 | Monorepo Setup | ✅ DONE | Turborepo + Bun, oxlint/oxfmt (not Biome) |
| 2 | Frontend App Running | ✅ DONE | Vite + React 19, TanStack Router, Tailwind v4, Shadcn |
| 3 | Convex Database | ✅ DONE | 15+ tables, real-time queries, Zod on backend |
| 4 | Clerk Authentication | ✅ DONE | OAuth, OTP, orgs, RBAC, team invitations |
| 5 | Stripe Payments | ✅ DONE | Subscriptions, Connect (payment fields), webhooks |
| **Document Management Layer** | | | |
| 6 | File Upload System | ✅ DONE | PDF upload, drag-drop, validation, metadata |
| 7 | Document Library & Search | ✅ DONE | List, sort, search, PDF viewer, templates |
| **Signature Workflow Layer** | | | |
| 8 | Document Preparation | ✅ DONE | Konva canvas, drag-drop fields, recipient assignment, field properties |
| 9 | Signature Capture & Signing | ✅ DONE | Draw/type/upload, signing page, field navigation. SHA-256 hashing, document integrity verification, signature encryption (AES-256-GCM) |
| 10 | Email Notifications | ✅ DONE | Resend + React Email: invitation, completion, reminder, cancellation, welcome, team invite. Resend webhook delivery tracking |
| 11 | Document Status Tracking | ✅ DONE | Real-time status, recipient tracking, activity feed, reminders |
| **User Experience Layer** | | | |
| 12 | Sender Dashboard | ✅ DONE | Stats cards, recharts trends, recent docs, quick actions. Analytics page with area/bar/pie charts |
| 13 | Mobile Optimization | 🟡 PARTIAL | Responsive Tailwind classes throughout; `useIsMobile` hook. **Gap**: document editor canvas not touch-optimized (tap-to-place needed) |
| 14 | Notifications & Onboarding | 🟡 PARTIAL | In-app notifications with user preference enforcement done. **Gap**: no welcome tour, no guided walkthrough, no onboarding wizard |
| **Business Integration Layer** | | | |
| 15 | Public REST API | ✅ DONE | Full v1 endpoints with email triggers wired. Clerk API key auth, sliding window rate limiting |
| 16 | Webhooks System | ✅ DONE | Full delivery pipeline: management API, HMAC-SHA256 signed HTTP delivery, exponential backoff retries, cron processing, event publishing from mutations |
| **Quality & Launch Layer** | | | |
| 17 | Testing | 🟡 PARTIAL | Vitest backend (113 tests), frontend (29 tests), Playwright E2E setup. **Gap**: no performance testing, no load testing, coverage unknown |
| 18 | Security & Compliance | ✅ DONE | ESIGN Act 5 requirements implemented: consent modal, IP tracking, SHA-256 integrity, token hashing, 7-year retention, certificate of completion. See `compliance-implementation-checklist.md`. **Remaining**: legal review, security audit, pen testing |
| 19 | Production Deployment | 🟡 PARTIAL | Convex + Vercel deployed. Sentry wired in error boundary. Security headers configured. CI/CD via GitHub Actions. **Gap**: no smoke tests |
| 20 | Launch Prep | 🟡 PARTIAL | Landing page done. **Gap**: no demo videos, no user/developer docs site, no GitHub open-source prep |

### Additional Work Not in Original Roadmap

| Feature | Status | Notes |
|---|---|---|
| Payment Field Builder | ✅ DONE | Stripe Connect invoicing: one-time, recurring, installments, deposit+balance. Payment completion enforced before signing |
| Document Sharing System | ✅ DONE (core) | Share dialog, access levels, Pro plan gates. See `IMPROVEMENT_PLAN_SHARED_DOCUMENTS.md` for 9 remaining items |
| Row-Level Security (RLS) | ✅ DONE | Private/workspace/specific access modes |
| Advanced Field Types | ✅ DONE | Dropdown, radio, number, date, checkbox (multi-option), attachment (Convex Storage upload), payment |
| ESIGN Compliance Suite | ✅ DONE | Consent dialog, audit trail hardening (logActionRequired), certificate of completion, download tokens, data export (GDPR/CCPA), signature encryption |
| Webhook Delivery | ✅ DONE | HMAC-SHA256 signing, exponential backoff, cron processing, auto-disable after 10 failures |

---

## Foundation Layer

**Why first**: Can't build features without these working

### 1. Monorepo Setup

- Initialize Turborepo with Bun workspaces
- Configure Biome for linting/formatting
- Setup TypeScript configs across packages
- Get `bun install` and `bun run build` working

**Documentation References**:

- **Project Overview**: `/README.md`
- **Tech Stack**: `/docusign-oss-vision.md` (lines 43-113)
- **Monorepo Structure**: `/docusign-oss-vision.md` (lines 14-31)
- **Deployment Architecture**: `/docusign-oss-vision.md` (lines 33-40)
- **MVP Phases**: `/mvp-gameplan-structure.md` (Phase 1: Core Infrastructure)

**Done when**: All packages install and build successfully

---

### 2. Frontend App Running

- Vite + React app running on localhost
- TanStack Router with basic routes (landing, sign-in, sign-up, dashboard)
- Tailwind CSS configured and working
- shadcn/ui components installed and rendering (Button, Card, Input, Form, Dialog, etc.)
- Basic layouts created (auth layout, dashboard layout)
- Error pages and states

**Documentation References**:

- **Tech Stack**: `/docusign-oss-vision.md` (lines 49-70)
- **UI Design System**: `/design-phase/ui-specifications/component-library.md`
- **Design Tokens**: `/design-phase/ui-specifications/design-tokens.md`
- **shadcn Mapping**: `/design-phase/ascii-to-shadcn-mapping.md`
- **Responsive Breakpoints**: `/design-phase/ui-specifications/responsive-breakpoints.md`
- **Typography**: `/design-phase/ui-specifications/typography.md`
- **Design Blueprint**: `/design-phase/design-blueprint.md`
- **Wireframe Conventions**: `/design-phase/wireframe-conventions.md`
- **Sitemap**: `/design-phase/information-architecture/sitemap.md`
- **Navigation Structure**: `/design-phase/information-architecture/navigation-structure.md`
- **Component Interactions**: `/design-phase/component-interactions.md`
- **Feature Spec (Error Pages)**: `/features/system/error-pages/feature-spec.md`
- **User Flows (Error Pages)**: `/features/system/error-pages/user-flows.md`
- **Wireframes (Error States)**: `/features/system/error-pages/wireframes/01-error-states.md`
- **MVP Phases**: `/mvp-gameplan-structure.md` (Phase 1: Core Infrastructure)

**Done when**: Can navigate between styled pages in browser

---

### 3. Convex Database

- Convex project initialized and deployed
- Database schemas defined (users, organizations, workspaces, documents, signatures, audit_logs)
- Basic queries and mutations working
- Frontend can read/write to Convex in real-time
- Zod schemas for validation

**Documentation References**:

- **Tech Stack**: `/docusign-oss-vision.md` (lines 56-58, 67-70)
- **Data Relationships**: `/design-phase/information-architecture/data-relationships.md`
- **State Documentation Patterns**: `/design-phase/state-documentation-patterns.md`

**Done when**: Frontend displays data from Convex that updates in real-time

---

### 4. Clerk Authentication

- Clerk project setup with OAuth providers (Google, Microsoft, Apple)
- Email/password + email verification (6-digit OTP) working
- Sign-up flow complete (email → verify → workspace creation)
- Sign-in flow complete
- Sign-out working
- Protected routes redirect unauthenticated users
- Clerk + Convex JWT integration (auth context in backend)
- Organizations/workspaces syncing between Clerk and Convex
- User profile and settings
- Workspace/organization management
- Team collaboration (invitations, roles, permissions)

**Documentation References**:

- **Feature Spec (Auth)**: `/features/authentication/user-registration/feature-spec.md`
- **User Flows (Auth)**: `/features/authentication/user-registration/user-flows.md`
- **Wireframes (Auth)**:
  - Landing Page: `/features/authentication/user-registration/wireframes/01-landing-page.md`
  - Sign-Up Form: `/features/authentication/user-registration/wireframes/02-sign-up-form.md`
  - Sign-In Form: `/features/authentication/user-registration/wireframes/03-sign-in-form.md`
  - OTP Verification: `/features/authentication/user-registration/wireframes/04-otp-verification.md`
  - Password Reset: `/features/authentication/user-registration/wireframes/05-password-reset.md`
  - Workspace Creation: `/features/authentication/user-registration/wireframes/06-workspace-creation.md`
  - Permission Requirements: `/features/authentication/user-registration/wireframes/07-permission-requirements.md`
- **Feature Spec (User Profile)**: `/features/authentication/user-profile/feature-spec.md`
- **User Flows (User Profile)**: `/features/authentication/user-profile/user-flows.md`
- **Wireframes (User Profile)**:
  - Profile Settings: `/features/authentication/user-profile/wireframes/01-profile-settings.md`
  - Notification Preferences: `/features/authentication/user-profile/wireframes/02-notification-preferences.md`
  - Usage Statistics: `/features/authentication/user-profile/wireframes/03-usage-statistics.md`
  - Account Settings: `/features/authentication/user-profile/wireframes/04-account-settings.md`
  - Integrations Settings: `/features/authentication/user-profile/wireframes/05-integrations-settings.md`
- **Feature Spec (Organization)**: `/features/workspace-management/organization-management/feature-spec.md`
- **User Flows (Organization)**: `/features/workspace-management/organization-management/user-flows.md`
- **Wireframes (Organization)**:
  - Workspace Creation: `/features/workspace-management/organization-management/wireframes/01-workspace-creation.md`
  - Member Management: `/features/workspace-management/organization-management/wireframes/02-member-management.md`
  - Workspace Switching: `/features/workspace-management/organization-management/wireframes/03-workspace-switching.md`
- **Feature Spec (Team Collaboration)**: `/features/workspace-management/team-collaboration/feature-spec.md`
- **User Flows (Team Collaboration)**: `/features/workspace-management/team-collaboration/user-flows.md`
- **Wireframes (Team Collaboration)**:
  - Team Management: `/features/workspace-management/team-collaboration/wireframes/01-team-management.md`
  - Document Sharing: `/features/workspace-management/team-collaboration/wireframes/02-document-sharing.md`
- **User Permissions Matrix**: `/design-phase/information-architecture/user-permissions-matrix.md`
- **Tech Stack**: `/docusign-oss-vision.md` (lines 59-60)
- **Form Patterns**: `/design-phase/interaction-patterns/form-patterns.md`
- **Loading States**: `/design-phase/interaction-patterns/loading-states.md`

**Done when**: Can sign up, verify email, create workspace, sign out, and sign back in

---

### 5. Stripe Payments

- Stripe account configured with products (Free plan, Pro plan)
- Subscription creation working
- Checkout flow complete
- Webhooks processing subscription events
- Billing dashboard showing current plan
- Usage limits enforced based on subscription tier
- Customer portal for managing billing

**Documentation References**:

- **Feature Spec**: `/features/workspace-management/billing-subscription/feature-spec.md`
- **User Flows**: `/features/workspace-management/billing-subscription/user-flows.md`
- **Wireframes**: `/features/workspace-management/billing-subscription/wireframes/01-billing-dashboard.md`
- **Tech Stack**: `/docusign-oss-vision.md` (line 60)

**Done when**: Can subscribe to Pro plan with test card and see subscription status

---

## Document Management Layer

**Why second**: Need docs before you can sign them

### 6. File Upload System

- PDF upload to Convex file storage
- Drag-and-drop upload UI with progress
- File validation (PDF only, size limits)
- Document metadata (title, description, tags) saved
- PDF preview generation
- Thumbnail creation
- Link documents to workspaces with permissions
- PDF processing and text extraction

**Documentation References**:

- **Feature Spec (Upload)**: `/features/document-management/document-upload/feature-spec.md`
- **User Flows (Upload)**: `/features/document-management/document-upload/user-flows.md`
- **Wireframes (Upload)**:
  - Upload Interface: `/features/document-management/document-upload/wireframes/01-document-upload-interface.md`
  - Preview & Management: `/features/document-management/document-upload/wireframes/02-document-preview-management.md`
- **Feature Spec (Processing)**: `/features/document-management/document-processing/feature-spec.md`
- **User Flows (Processing)**: `/features/document-management/document-processing/user-flows.md`
- **Wireframes (Processing)**: `/features/document-management/document-processing/wireframes/01-processing-interface.md`
- **PDF Architecture**: `/pdf-library-architecture.md`
- **Tech Stack (PDF)**: `/docusign-oss-vision.md` (lines 72-78)
- **Tech Stack (Search/OCR)**: `/docusign-oss-vision.md` (lines 94-99)
- **Drag-Drop Patterns**: `/design-phase/interaction-patterns/drag-drop-patterns.md`
- **Loading States**: `/design-phase/interaction-patterns/enhanced-loading-states.md`
- **MVP Phases**: `/mvp-gameplan-structure.md` (Phase 2: Document Management)

**Done when**: Upload PDF and see it in document library with preview

---

### 7. Document Library & Search

- Document list view with sorting and pagination
- Fuzzy search with fuse.js
- Filter by status, date, tags
- Full PDF viewer (zoom, page navigation, download)
- Template creation and management
- Template library with "Use Template" feature

**Documentation References**:

- **Feature Spec (Library)**: `/features/document-management/document-library/feature-spec.md`
- **User Flows (Library)**: `/features/document-management/document-library/user-flows.md`
- **Wireframes (Library)**: `/features/document-management/document-library/wireframes/01-main-library-interface.md`
- **Feature Spec (Search)**: `/features/document-management/search-filtering/feature-spec.md`
- **User Flows (Search)**: `/features/document-management/search-filtering/user-flows.md`
- **Wireframes (Search)**: `/features/document-management/search-filtering/wireframes/01-search-interface.md`
- **Feature Spec (Templates)**: `/features/document-management/document-templates/feature-spec.md`
- **User Flows (Templates)**: `/features/document-management/document-templates/user-flows.md`
- **Wireframes (Templates)**: `/features/document-management/document-templates/wireframes/01-template-interface.md`
- **PDF Architecture**: `/pdf-library-architecture.md` (Display section)
- **Tech Stack (Search)**: `/docusign-oss-vision.md` (lines 94-99)

**Done when**: Can browse uploaded docs, search by name, view PDFs

---

## Signature Workflow Layer

**Why third**: Core value proposition of the product

### 8. Document Preparation

- konva.js canvas layer over PDF
- Drag-and-drop signature fields onto document
- Field types: signature, text, date, checkbox
- Field positioning, resizing, multi-page placement
- Field properties panel (required/optional, validation rules)
- Assign fields to recipients
- Save field coordinates to database
- pdf-lib integration to embed fields in PDF
- Preparation wizard (upload → place fields → assign recipients → preview)

**Documentation References**:

- **Feature Spec (Preparation)**: `/features/signature-workflow/document-preparation-interface/feature-spec.md`
- **User Flows (Preparation)**: `/features/signature-workflow/document-preparation-interface/user-flows.md`
- **Wireframes (Preparation)**: `/features/signature-workflow/document-preparation-interface/wireframes/01-document-preparation-interface.md`
- **Feature Spec (Field Management)**: `/features/signature-workflow/signature-field-management/feature-spec.md`
- **User Flows (Field Management)**: `/features/signature-workflow/signature-field-management/user-flows.md`
- **Wireframes (Field Placement)**: `/features/signature-workflow/signature-field-management/wireframes/01-field-placement-interface.md`
- **Feature Spec (Recipient Management)**: `/features/signature-workflow/recipient-management/feature-spec.md`
- **User Flows (Recipient Management)**: `/features/signature-workflow/recipient-management/user-flows.md`
- **Wireframes (Recipient Setup)**: `/features/signature-workflow/recipient-management/wireframes/01-recipient-setup-interface.md`
- **PDF Architecture**: `/pdf-library-architecture.md` (PDF-lib section)
- **Tech Stack (Canvas)**: `/docusign-oss-vision.md` (lines 80-84)
- **Tech Stack (PDF Manipulation)**: `/docusign-oss-vision.md` (lines 74-75)
- **Drag-Drop Patterns**: `/design-phase/interaction-patterns/drag-drop-patterns.md`
- **MVP Phases**: `/mvp-gameplan-structure.md` (Phase 3: Signature Core)

**Done when**: Can place signature fields on PDF and assign them to recipients

---

### 9. Signature Capture & Signing

- react-signature-canvas for drawing signatures
- Signature types: draw, type, upload image
- Signature library (save and reuse signatures)
- Web Crypto API for digital signatures (document hashing, certificates)
- Signer document view showing all required fields
- Field completion tracking with progress indicator
- Embed signatures in PDF with pdf-lib
- Signature verification
- Completion confirmation screen
- Make signed PDFs immutable

**Documentation References**:

- **Feature Spec**: `/features/signature-workflow/signing-experience/feature-spec.md`
- **User Flows**: `/features/signature-workflow/signing-experience/user-flows.md`
- **Wireframes**:
  - Signing Interface: `/features/signature-workflow/signing-experience/wireframes/01-signing-interface.md`
  - Mobile Signature Capture: `/features/signature-workflow/signing-experience/wireframes/02-mobile-signature-capture.md`
- **Feature Spec (Digital Signatures)**: `/features/signature-workflow/digital-signature-implementation/feature-spec.md`
- **User Flows (Digital Signatures)**: `/features/signature-workflow/digital-signature-implementation/user-flows.md`
- **Wireframes (Signature Creation)**: `/features/signature-workflow/digital-signature-implementation/wireframes/01-signature-creation-interface.md`
- **PDF Architecture**: `/pdf-library-architecture.md` (Signing Flow section)
- **Tech Stack (Signature Canvas)**: `/docusign-oss-vision.md` (line 76)
- **Tech Stack (Crypto)**: `/docusign-oss-vision.md` (line 86)
- **Security Compliance**: `/features/authentication/security-compliance/feature-spec.md`

**Done when**: Recipient can open document, sign it, and complete the flow

---

### 10. Email Notifications

- Resend email delivery setup
- React Email templates for:
  - Document invitation
  - Document completed
  - Reminder emails
  - Welcome email
  - Team invitations
- Email sending from Convex mutations
- Email delivery tracking

**Documentation References**:

- **Feature Spec**: `/features/communications/email-integration/feature-spec.md`
- **User Flows**: `/features/communications/email-integration/user-flows.md`
- **Wireframes**:
  - Email Compose Interface: `/features/communications/email-integration/wireframes/01-email-compose-interface.md`
  - Email Compose and Send: `/features/communications/email-integration/wireframes/01-email-compose-and-send.md`
- **Tech Stack (Email)**: `/docusign-oss-vision.md` (lines 77-78)

**Done when**: Recipient receives email and can click link to sign document

---

### 11. Document Status Tracking

- Document status: draft, sent, viewed, completed, declined, expired
- Status transitions with audit logging
- Recipient tracking (viewed, signed, declined timestamps)
- Completion percentage calculator
- Reminder system with scheduling
- Expiration date enforcement
- Real-time status updates via Convex subscriptions
- Activity feed showing document history
- Toast notifications on status changes

**Documentation References**:

- **Feature Spec**: `/features/signature-workflow/document-status-tracking/feature-spec.md`
- **User Flows**: `/features/signature-workflow/document-status-tracking/user-flows.md`
- **Wireframes**: `/features/signature-workflow/document-status-tracking/wireframes/01-status-tracking-interface.md`
- **Feature Spec (Document Sending)**: `/features/signature-workflow/document-sending/feature-spec.md`
- **User Flows (Document Sending)**: `/features/signature-workflow/document-sending/user-flows.md`
- **Wireframes (Document Sending)**: `/features/signature-workflow/document-sending/wireframes/01-document-sending-interface.md`
- **State Documentation Patterns**: `/design-phase/state-documentation-patterns.md`
- **Notifications Patterns**: `/design-phase/interaction-patterns/notifications.md`

**Done when**: Sender sees live status updates as recipient signs

---

## User Experience Layer

**Why fourth**: Make it actually usable and delightful

### 12. Sender Dashboard

- Stats cards (pending, completed, declined counts)
- Recent documents list
- Activity timeline
- Document volume trends (charts with recharts)
- Completion rate analytics
- Quick actions (upload, filter, batch operations)
- Workspace switcher
- Export functionality

**Documentation References**:

- **Feature Spec**: `/features/dashboards-analytics/sender-dashboard/feature-spec.md`
- **User Flows**: `/features/dashboards-analytics/sender-dashboard/user-flows.md`
- **Wireframes**: `/features/dashboards-analytics/sender-dashboard/wireframes/01-sender-dashboard-interface.md`
- **Navigation Structure**: `/design-phase/information-architecture/navigation-structure.md`

**Done when**: Dashboard shows meaningful stats and recent activity

---

### 13. Mobile Optimization

- All pages responsive (320px to 1920px)
- Mobile-friendly signature canvas (touch optimized)
- Larger touch targets (min 44px)
- Mobile dashboard layout
- Mobile PDF navigation
- Test on iOS and Android browsers
- Optimize performance for slower connections
- Bundle size optimization

**Documentation References**:

- **Responsive Breakpoints**: `/design-phase/ui-specifications/responsive-breakpoints.md`
- **Mobile Signature Capture**: `/features/signature-workflow/signing-experience/wireframes/02-mobile-signature-capture.md`
- **Component Interactions**: `/design-phase/component-interactions.md`

**Done when**: Complete workflow works smoothly on iPhone and Android

---

### 14. Notifications & Onboarding

- In-app notification center (toast notifications with sonner)
- Real-time notification delivery via Convex
- Notification preferences per user
- Welcome tour / guided walkthrough
- Empty states with helpful CTAs
- Quick-start checklist for new users
- Sample documents/templates
- Contextual help tooltips
- Landing page

**Documentation References**:

- **Feature Spec (Onboarding)**: `/features/workspace-management/landing-onboarding/feature-spec.md`
- **User Flows (Onboarding)**: `/features/workspace-management/landing-onboarding/user-flows.md`
- **Wireframes (Onboarding)**:
  - Hero Landing Page: `/features/workspace-management/landing-onboarding/wireframes/01-hero-landing-page.md`
  - Onboarding Flow: `/features/workspace-management/landing-onboarding/wireframes/02-onboarding-flow.md`
  - Interactive Demo: `/features/workspace-management/landing-onboarding/wireframes/03-interactive-demo.md`
- **Wireframes (Notification Preferences)**: `/features/authentication/user-profile/wireframes/02-notification-preferences.md`
- **Notifications Patterns**: `/design-phase/interaction-patterns/notifications.md`
- **Future: Advanced Notification System**: `/future-work.md` (lines 133-147)

**Done when**: New user completes onboarding and understands how to use the app

---

## Business Integration Layer

**Why fifth**: Enable developers to integrate

### 15. Public REST API

- API route infrastructure
- API key authentication via Clerk
- Rate limiting
- API versioning (v1)
- Core endpoints:
  - POST `/v1/documents/upload`
  - POST `/v1/documents/send`
  - GET `/v1/documents/:id`
  - GET `/v1/documents`
  - POST `/v1/webhooks`
- API documentation site with multi-language examples (cURL, JS, Python, Go, Ruby)
- Interactive API explorer
- Authentication guide

**Documentation References**:

- **Feature Spec (External API)**: `/features/developer-api/external-api-integration/feature-spec.md`
- **User Flows (External API)**: `/features/developer-api/external-api-integration/user-flows.md`
- **Wireframes (API Integration)**: `/features/developer-api/external-api-integration/wireframes/01-api-integration-interface.md`
- **Feature Spec (Developer Experience)**: `/features/developer-api/developer-experience/feature-spec.md`
- **User Flows (Developer Experience)**: `/features/developer-api/developer-experience/user-flows.md`
- **Wireframes (Developer Portal)**: `/features/developer-api/developer-experience/wireframes/01-developer-portal-interface.md`
- **Brand Positioning**: `/docusign-oss-vision.md` (lines 218-236 - API-first messaging)

**Done when**: Can make API call with API key and get valid response

---

### 16. Webhooks System

- Webhook registration in database
- Webhook delivery queue with retry logic (exponential backoff)
- Webhook signature verification
- Events:
  - `document.sent`
  - `document.viewed`
  - `document.completed`
  - `document.declined`
  - `document.expired`
- Webhook management UI (register, test, view logs, enable/disable)
- Webhook delivery logs

**Documentation References**:

- **Feature Spec (External API)**: `/features/developer-api/external-api-integration/feature-spec.md`
- **User Flows (External API)**: `/features/developer-api/external-api-integration/user-flows.md`
- **Future: DocuSign Connect Equivalent**: `/future-work.md` (lines 40-46)

**Done when**: Register webhook, trigger event, verify delivery with correct payload

---

## Quality & Launch Layer

**Why last**: Make sure it's solid before shipping

### 17. Testing

- Vitest unit tests for Convex functions and React components (>80% coverage)
- Integration tests for auth, document upload → sign → complete flow, API endpoints, webhooks, payments
- Playwright E2E tests for critical user journeys:
  - Sign up new user
  - Upload and send document
  - Sign document as recipient
  - Manage subscription
- Performance testing:
  - Page load times <2s
  - Large PDF handling (50+ pages)
  - Database query optimization
  - Bundle size optimization
  - Load testing with 100 concurrent users

**Documentation References**:

- **Tech Stack (Testing)**: `/docusign-oss-vision.md` (lines 109-113)
- **Performance Requirements**: `/future-work.md` (lines 207-212)
- **Success Criteria**: `/mvp-gameplan-structure.md` (lines 107-118)

**Done when**: All tests pass and performance benchmarks met

---

### 18. Security & Compliance

- Security scanning (npm audit, Snyk)
- Auth vulnerability testing (CSRF, XSS)
- File upload security audit
- API security review
- Rate limiting verification
- ESIGN Act compliance verification:
  - Intent to sign captured
  - Consent to electronic business
  - Opt-out option available
  - Signed copies distributed
  - Records retained properly
- Audit trail completeness check
- Document immutability verification
- Data encryption at rest and in transit

**Documentation References**:

- **Feature Spec (Security)**: `/features/authentication/security-compliance/feature-spec.md`
- **User Flows (Security)**: `/features/authentication/security-compliance/user-flows.md`
- **Wireframes (Security)**:
  - Electronic Consent: `/features/authentication/security-compliance/wireframes/01-electronic-consent.md`
  - Security Alerts: `/features/authentication/security-compliance/wireframes/02-security-alerts.md`
  - Audit Dashboard: `/features/authentication/security-compliance/wireframes/03-audit-dashboard.md`
- **Feature Spec (Audit)**: `/features/compliance-audit/feature-spec.md`
- **User Flows (Audit)**: `/features/compliance-audit/user-flows.md`
- **Wireframes (Audit Trail)**: `/features/compliance-audit/wireframes/01-audit-trail-interface.md`
- **Compliance Checklist**: `/compliance-implementation-checklist.md`
- **Legal Requirements**: `/future-work.md` (lines 250-265)

**Done when**: No critical vulnerabilities, compliance verified

---

### 19. Production Deployment

- Production Convex deployment
- Vercel production deployment
- Production environment variables configured
- Production Clerk app configured
- Production Stripe account configured
- Custom domain + SSL
- Sentry monitoring configured
- Production smoke tests passing

**Documentation References**:

- **Tech Stack (Deployment)**: `/docusign-oss-vision.md` (lines 62-65)
- **Tech Stack (Monitoring)**: `/docusign-oss-vision.md` (lines 90-92)
- **Deployment Architecture**: `/docusign-oss-vision.md` (lines 33-40)

**Done when**: Production app is live and functional

---

### 20. Launch Prep

- Marketing landing page
- Demo videos
- User documentation
- Developer documentation
- Support email setup
- GitHub repository prepared for open source
- Launch announcements drafted (Product Hunt, HackerNews, Twitter)

**Documentation References**:

- **Brand Positioning**: `/docusign-oss-vision.md` (lines 206-286)
- **Go-to-Market Strategy**: `/docusign-oss-vision.md` (lines 171-189)
- **Community Strategy**: `/docusign-oss-vision.md` (lines 191-195)
- **Competitive Messaging**: `/docusign-oss-vision.md` (lines 260-275)
- **Success Metrics**: `/docusign-oss-vision.md` (lines 197-203)
- **Competitive Analysis**: `/competitor-analysis.md`
- **Target Market**: `/docusign-oss-vision.md` (lines 122-131)
- **Competitive Landscape**: `/docusign-oss-vision.md` (lines 133-154)
- **Value Propositions**: `/docusign-oss-vision.md` (lines 156-169)

---

## Critical Dependencies

**Can't do these things until these other things are done:**

- Can't test auth without Clerk setup
- Can't upload documents without Convex file storage
- Can't place signature fields without document upload working
- Can't send for signature without email system
- Can't sign documents without signature capture + digital signature implementation
- Can't track status without document and signature schemas
- Can't build API without core features working
- Can't do webhooks without event system in place
- Can't launch without security audit

---

## MVP Scope: What's IN vs OUT

**IN (Must Build)**

- Everything listed above (1-20)

**OUT (Future Work)**

- Advanced field types (calculated fields, conditional fields)
- CRM integrations (HubSpot, Salesforce)
- Advanced workflow automation
- Bulk operations
- Advanced analytics/reporting
- Mobile native apps
- Document conversion (Office to PDF)
- SOC 2 / HIPAA compliance
- White-label branding
- Enterprise admin features

---

## Definition of Done for MVP

- User can sign up, verify email, create workspace
- User can upload PDF
- User can place signature fields and send to recipient
- Recipient receives email
- Recipient can sign document
- Sender sees real-time status updates
- Signed PDF is immutable and downloadable
- Payments work (free tier + pro subscription)
- API works for basic operations
- Mobile experience functional
- Security audit passed
- Production deployed and stable

**That's the entire build sequence.**

---

## Documentation Index

Every deliverable above references existing documentation. Here's the complete documentation structure:

### Core Vision & Architecture

- `/docusign-oss-vision.md` - Tech stack, brand positioning, competitive strategy
- `/pdf-library-architecture.md` - PDF processing libraries and their roles
- `/mvp-gameplan-structure.md` - Original MVP plan and phases
- `/future-work.md` - Post-MVP features and roadmap
- `/competitor-analysis.md` - Competitive landscape analysis
- `/compliance-implementation-checklist.md` - Legal compliance requirements

### Feature Documentation (29 Features)

Each feature has:

- `feature-spec.md` - Requirements, edge cases, technical details
- `user-flows.md` - User journey and interaction flows
- `wireframes/` - ASCII wireframes for UI implementation

**Feature Categories**:

- `/features/authentication/` - User registration, profile, security compliance
- `/features/document-management/` - Upload, library, templates, search, processing
- `/features/signature-workflow/` - Document preparation, field management, signing, status tracking
- `/features/workspace-management/` - Organizations, teams, billing, onboarding
- `/features/communications/` - Email integration and notifications
- `/features/dashboards-analytics/` - Sender dashboard, advanced analytics
- `/features/developer-api/` - REST API, webhooks, developer portal
- `/features/compliance-audit/` - Audit trails and compliance reporting
- `/features/bulk-operations/` - Batch document operations
- `/features/system/` - Error pages and system-level features

### Design System Documentation

- `/design-phase/ui-specifications/` - Component library, design tokens, typography, breakpoints
- `/design-phase/interaction-patterns/` - Drag-drop, forms, loading states, notifications
- `/design-phase/information-architecture/` - Sitemap, navigation, data relationships
- `/design-phase/ascii-to-shadcn-mapping.md` - Wireframe to shadcn component mapping
- `/design-phase/component-interactions.md` - Interactive component patterns
- `/design-phase/flow-diagram-standards.md` - Flow diagram conventions
- `/design-phase/state-documentation-patterns.md` - State management patterns
- `/design-phase/wireframe-conventions.md` - How to read wireframes

---

## How To Use This Roadmap

### For Engineers

1. **Pick a deliverable** (e.g., "4. Clerk Authentication")
2. **Read the feature specs** listed in "Documentation References"
3. **Review wireframes** to understand UI requirements
4. **Check user flows** to understand interaction patterns
5. **Implement based on detailed requirements** in those docs
6. **Mark "Done when"** criteria is met

### For Product Review

1. **Check the feature spec** to understand what was supposed to be built
2. **Review user flows** to see expected user journey
3. **Compare implementation** against wireframes
4. **Verify "Done when"** criteria is met
5. **Approve or provide feedback** for iteration

### For Creating Tickets

Each deliverable becomes a ticket with:

- **Title**: The deliverable name (e.g., "Clerk Authentication")
- **Description**: The bullet list of what gets built
- **Acceptance Criteria**: The "Done when" statement
- **Documentation Links**: All the references listed
- **Dependencies**: Check "Critical Dependencies" section

---

**This roadmap is a navigation tool to the weeks of detailed documentation you've already created. No need to rewrite requirements - just point engineers to the right docs.**
