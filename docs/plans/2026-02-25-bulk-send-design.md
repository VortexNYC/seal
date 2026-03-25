# Bulk Send — Design Document

> **Status:** NOT STARTED

## Goal

Allow users to send the same document (template) to many recipients at once — tens to thousands — each as an independent envelope. Primary use cases: HR onboarding packets, mass NDAs, policy acknowledgments, client agreements.

## Current State

Today, Seal sends documents one-at-a-time: one document → one set of recipients. `sendDocumentEmails` action loops through recipients and sends emails synchronously. There is no concept of "send this template to a list of people."

## Design

### User Flow

1. User navigates to a template or document and clicks **"Bulk Send"**
2. **Upload step**: Upload a CSV file mapping recipient data to fields. CSV columns: `email` (required), `firstName`, `lastName`, `company`, `title`, plus any custom field mappings (e.g., `salary`, `startDate`)
3. **Preview step**: Show a table preview of parsed CSV rows. Highlight validation errors inline (missing email, invalid email format, duplicate emails). Show total count and error count.
4. **Configure step**: Map CSV columns to document fields. Set shared options: signing deadline, custom email message, reminder schedule (optional)
5. **Confirm & Send**: Show summary ("Send to 247 recipients?"). User confirms.
6. **Progress view**: Real-time progress dashboard showing sent/pending/failed counts. Each row shows recipient name, email, status (queued → sending → sent → viewed → signed / failed). Retry button for failed sends.

### Architecture

#### New Schema: `bulk_send_jobs`

```
bulk_send_jobs:
  organizationId: Id<"organizations">
  templateId: Id<"documents">           // Source template
  name: string                           // Job name (e.g., "Q1 NDA Rollout")
  status: "preparing" | "sending" | "completed" | "cancelled"
  csvStorageId: Id<"_storage">           // Original CSV file
  fieldMappings: Record<string, string>  // CSV column → field label
  sharedConfig:
    deadline: number?                    // Signing deadline
    customMessage: string?               // Email body
    reminderSchedule: string?            // e.g., "3d,7d,14d"
  totalRecipients: number
  sentCount: number
  failedCount: number
  completedCount: number                 // Signed/approved
  createdBy: Id<"users">
  createdAt: number
  updatedAt: number
  completedAt: number?

  Indexes: by_organization, by_template, by_status
```

#### New Schema: `bulk_send_recipients`

```
bulk_send_recipients:
  jobId: Id<"bulk_send_jobs">
  documentId: Id<"documents">?          // Created document (null until created)
  recipientData: Record<string, string>  // Raw CSV row data
  email: string
  name: string
  status: "queued" | "creating" | "sent" | "failed" | "cancelled"
  error: string?                         // Error message if failed
  retryCount: number
  createdAt: number
  updatedAt: number

  Indexes: by_job, by_job_status, by_email
```

#### Processing Pipeline

Use `@convex-dev/workpool` (already in the project for AI jobs) to process bulk sends without overwhelming Resend rate limits or Convex function timeouts.

**Step 1: Job creation** (mutation)

- Parse CSV, validate all rows, create `bulk_send_jobs` + `bulk_send_recipients` records
- Status: `preparing`

**Step 2: Batch processing** (workpool action, 5 concurrent workers)

- For each recipient row:
  1. Clone the template document → new document with `bulkSendJobId` reference
  2. Add recipient from CSV data
  3. Apply field mappings (pre-fill fields from CSV columns)
  4. Call the existing `sendDocumentEmails` internal logic
  5. Update `bulk_send_recipients` status
  6. Increment `bulk_send_jobs.sentCount`
- On failure: set status to `failed`, store error, increment `failedCount`

**Step 3: Completion** (triggered when all recipients processed)

- Set job status to `completed`
- Send summary email to the sender

#### Rate Limiting

- Resend free tier: 100 emails/day, 1/second
- Resend production: 50/second burst
- Workpool concurrency of 5 with 200ms delay between sends ensures ~25/second max throughput
- For jobs >1000 recipients, show estimated completion time

#### Retry Logic

- Failed sends can be retried individually or in bulk ("Retry all failed")
- Max 3 automatic retries with exponential backoff (1min, 5min, 15min)
- After 3 failures, marked as `failed` — requires manual retry

### Frontend

#### New Route: `/{slug}/bulk-send`

Accessible from template actions dropdown ("Bulk Send") or a dedicated section in the sidebar.

**Bulk Send Job List page** (`/{slug}/bulk-send/`):

- Table of past/active bulk send jobs
- Columns: Name, Template, Recipients, Progress (bar), Status, Created, Actions
- Filter by status

**Bulk Send Wizard** (`/{slug}/bulk-send/new?templateId=xxx`):

- Step 1: CSV upload with drag-drop + file picker
- Step 2: Preview table with inline validation
- Step 3: Column mapping with dropdowns
- Step 4: Confirm and send

**Job Detail page** (`/{slug}/bulk-send/{jobId}`):

- Real-time progress bar (Convex live queries)
- Recipient table with status, link to individual document
- Bulk actions: Cancel remaining, Retry failed, Export results CSV

### Permissions

- New permissions: `bulk_send:create`, `bulk_send:view`
- Admin and Owner roles get both by default
- Member role gets `bulk_send:view` only (can see jobs but not create)

### Limits

- Free plan: 50 recipients per job, 1 active job at a time
- Pro plan: 5,000 recipients per job, unlimited active jobs
- CSV file size limit: 5MB
- Max CSV columns: 50

### What We Skip (v1)

- No SMS/WhatsApp delivery (email only)
- No conditional field logic per recipient (all get same fields)
- No scheduling (send later) — sends immediately on confirm
- No merge tags in document text (only field pre-fill)
- No webhook events for bulk send (individual document webhooks still fire)

### Key Files to Modify/Create

| File                                                  | Action                                    |
| ----------------------------------------------------- | ----------------------------------------- |
| `apps/backend/convex/schemas/bulk_send.ts`            | Create — both tables                      |
| `apps/backend/convex/schema.ts`                       | Modify — register tables                  |
| `apps/backend/convex/bulk_send/mutations.ts`          | Create — job CRUD, CSV parsing            |
| `apps/backend/convex/bulk_send/queries.ts`            | Create — job list, detail, recipient list |
| `apps/backend/convex/bulk_send/actions.ts`            | Create — workpool processing              |
| `apps/backend/convex/auth/permissions.ts`             | Modify — add bulk_send permissions        |
| `apps/web/src/routes/_authenticated/$slug/bulk-send/` | Create — list, new, detail pages          |
| `apps/web/src/components/app-sidebar.tsx`             | Modify — add Bulk Send nav item           |
