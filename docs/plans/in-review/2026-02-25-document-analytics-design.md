# Document Analytics Enhancements — Design Document

> **Status:** IMPLEMENTED — Email engagement, recipient timing, template performance, and analytics tabs all merged to staging (`337718c`, `3726a04`).

## Goal

Extend Seal's existing analytics with deeper document-level insights: per-document funnel metrics, email engagement tracking, recipient timing analysis, and template performance comparison. These are the metrics that help users optimize their signing workflows and identify bottlenecks.

## Current State

Seal already has a solid analytics foundation:

**What exists:**

- Full analytics page at `/{slug}/analytics` with document activity trends, status breakdown, recent activity feed, team member stats, CSV/PDF export
- Home dashboard with key stats (total, pending, completed, completion rate, 30-day trends)
- 31 audit log action types covering documents, recipients, signatures, emails, users
- Comprehensive timestamps on documents (`sentAt`, `completedAt`) and recipients (`viewedAt`, `signedAt`, `approvedAt`, `declinedAt`)
- Email logs with `sentAt`, `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`
- `@convex-dev/aggregate` already used for AI usage tracking
- Personal vs. team scope with permission gating

**What's missing:**

- **Document funnel view** — no visualization of sent → viewed → signed conversion per document
- **Email engagement** — email open/click/bounce rates exist in `email_logs` but aren't surfaced in the analytics UI
- **Recipient timing** — time-to-view and time-to-sign per recipient aren't calculated or displayed
- **Template performance** — no comparison of which templates have the best completion rates
- **Per-document analytics** — no analytics on individual documents (just aggregate views)
- **Bottleneck detection** — no identification of which recipients are holding up documents

## Design

### 1. Per-Document Analytics Panel

Add an **"Analytics" tab** to the document detail page (`$documentId.tsx`):

**Recipient Funnel:**

```
Sent (3) → Viewed (2) → Signed (1) → Complete
  │           │           │
  └ Alice ────┘           │
  └ Bob ──────────────────┘
  └ Carol (pending - 3 days)
```

Visual horizontal funnel showing each recipient's progress with time at each stage.

**Timing Metrics (per recipient):**

| Recipient | Sent → Viewed | Viewed → Signed | Total Time |
| --------- | ------------- | --------------- | ---------- |
| Alice     | 2h 15m        | 1d 3h           | 1d 5h      |
| Bob       | 5m            | 23m             | 28m        |
| Carol     | 3d (waiting)  | —               | —          |

**Email Engagement (per recipient):**

- Invitation email: Delivered ✓ / Opened ✓ / Clicked ✓
- Reminder emails: count sent, open rate
- Bounce/failure indicators

All data already exists in `document_recipients` timestamps and `email_logs` — this is a pure frontend feature backed by a new query.

### 2. Enhanced Analytics Dashboard

Add new sections to the existing `/{slug}/analytics` page:

#### Email Engagement Section (new tab)

| Metric             | Calculation                                  |
| ------------------ | -------------------------------------------- |
| Delivery rate      | `deliveredAt / sentAt` across all email logs |
| Open rate          | `openedAt / deliveredAt`                     |
| Click-through rate | `clickedAt / openedAt`                       |
| Bounce rate        | `bouncedAt / sentAt`                         |
| Avg time to open   | Mean of `openedAt - sentAt`                  |

Chart: Email engagement funnel (sent → delivered → opened → clicked) with period selector.

#### Recipient Timing Section (new tab)

| Metric               | Calculation                                        |
| -------------------- | -------------------------------------------------- |
| Avg time to view     | Mean of `viewedAt - sentAt` across recipients      |
| Avg time to sign     | Mean of `signedAt - viewedAt` across recipients    |
| Avg total turnaround | Mean of `signedAt - sentAt` (end-to-end)           |
| Fastest signer       | Min turnaround time                                |
| Slowest stage        | Which step (view vs sign) takes longest on average |

Chart: Distribution histogram of signing times (buckets: <1h, 1-6h, 6-24h, 1-3d, 3-7d, 7d+).

#### Template Performance Section (new tab, Pro only)

| Template             | Docs Sent | Completion Rate | Avg Turnaround | Decline Rate |
| -------------------- | --------- | --------------- | -------------- | ------------ |
| NDA v2               | 47        | 94%             | 1.2 days       | 2%           |
| Employment Agreement | 23        | 87%             | 3.1 days       | 9%           |
| Freelancer Contract  | 12        | 100%            | 0.4 days       | 0%           |

Compare templates by completion rate, turnaround time, and decline rate. Identify which templates need improvement.

### 3. Bottleneck Alerts

On the home dashboard, add a **"Needs Attention"** section:

- Documents where a recipient hasn't viewed after 3+ days
- Documents approaching their deadline with unsigned recipients
- Documents with bounced emails (recipient may never have received it)
- Documents with declined recipients requiring action

This is a filtered view of existing data — no new tracking needed.

### Backend Implementation

#### New Queries

```typescript
// Per-document analytics
getDocumentAnalytics(documentId) → {
  recipientFunnel: { sent, viewed, signed, declined, pending }[],
  recipientTimings: { recipientId, timeToView, timeToSign, totalTime }[],
  emailEngagement: { recipientId, emails: { type, sentAt, deliveredAt, openedAt }[] }[],
}

// Email engagement aggregates (across org)
getEmailEngagementStats(orgId, dateRange) → {
  deliveryRate, openRate, clickRate, bounceRate,
  avgTimeToOpen, trend: { date, sent, delivered, opened }[]
}

// Recipient timing aggregates
getRecipientTimingStats(orgId, dateRange) → {
  avgTimeToView, avgTimeToSign, avgTotalTurnaround,
  distribution: { bucket: string, count: number }[]
}

// Template performance
getTemplatePerformance(orgId, dateRange) → {
  templateId, templateName, docsSent, completionRate,
  avgTurnaround, declineRate
}[]

// Bottleneck detection
getDocumentsNeedingAttention(orgId) → {
  staleRecipients: { documentId, recipientId, daysPending }[],
  approachingDeadline: { documentId, deadline, unsignedCount }[],
  bouncedEmails: { documentId, recipientId, email }[],
}
```

All queries use `permissionQuery("documents:view")` and filter by organization scope. No new tables or schema changes — everything is derived from existing data.

#### Performance Considerations

Current analytics queries fetch all documents and aggregate in-memory. For the new queries:

- **Per-document analytics**: Only fetches recipients + emails for one document — fast, no optimization needed
- **Email engagement**: Joins `email_logs` by document/recipient — add index `by_org_date` on `email_logs` if not present
- **Recipient timing**: Scans `document_recipients` by org — reuses existing `by_organization` or `by_document` indexes
- **Template performance**: Groups documents by `templateId` (field already exists on documents) — add index `by_org_template` if performance is an issue
- For workspaces with 10K+ documents, consider moving aggregate metrics to `@convex-dev/aggregate` (same pattern as AI usage tracking)

### What We Skip (v1)

- **Real-time analytics streaming** — dashboards use standard Convex live queries, not custom streaming
- **Custom report builder** — no drag-and-drop report creation
- **Scheduled email reports** — no "send me a weekly digest" feature
- **A/B testing for templates** — no automated comparison of template variants
- **Recipient heatmaps** — no tracking of which document sections recipients spend time on
- **API analytics** — no tracking of API usage patterns (covered by rate limiter logs)

### Permissions

No new permissions — analytics are gated by existing `documents:view`. Team-wide analytics require admin role (existing behavior).

### Plan Gating

| Feature                    | Free | Pro |
| -------------------------- | ---- | --- |
| Per-document analytics     | Yes  | Yes |
| Email engagement dashboard | Yes  | Yes |
| Recipient timing dashboard | Yes  | Yes |
| Template performance       | No   | Yes |
| Bottleneck alerts          | Yes  | Yes |
| CSV/PDF export (existing)  | Yes  | Yes |

### Key Files to Modify/Create

| File                                                                 | Action                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/backend/convex/dashboard/queries.ts`                           | Modify — add new analytics queries                                         |
| `apps/web/src/routes/_authenticated/$slug/analytics.tsx`             | Modify — add email engagement, recipient timing, template performance tabs |
| `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx` | Modify — add Analytics tab to document detail                              |
| `apps/web/src/components/analytics/document-funnel.tsx`              | Create — per-document recipient funnel visualization                       |
| `apps/web/src/components/analytics/email-engagement.tsx`             | Create — email engagement charts                                           |
| `apps/web/src/components/analytics/recipient-timing.tsx`             | Create — timing distribution charts                                        |
| `apps/web/src/components/analytics/template-performance.tsx`         | Create — template comparison table                                         |
| `apps/web/src/routes/_authenticated/$slug/home.tsx`                  | Modify — add "Needs Attention" bottleneck section                          |
| `apps/backend/convex/schemas/email_logs.ts`                          | Modify — add `by_org_date` index if needed                                 |
