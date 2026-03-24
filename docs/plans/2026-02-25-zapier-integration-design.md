# Zapier Integration — Design Document

> **Status:** NOT STARTED

## Goal

Enable Seal users to connect their document workflows to 7,000+ apps via Zapier. Triggers fire when documents are sent, signed, completed, or declined. Actions allow creating documents from templates and sending them — all without writing code. This multiplies Seal's utility for operations teams who already use Zapier for automation.

## Current State

Seal has a working webhook system: organizations can register webhook endpoints (with HMAC-SHA256 signing) that receive events like `document.sent`, `document.completed`, `recipient.signed`, etc. Delivery uses exponential backoff retries via a cron-based processor in `webhooks/delivery.ts`. Seal also has a public REST API at `/api/v1/` with Clerk API key authentication. Neither system is connected to Zapier.

## Design

### How Zapier Integration Works

Zapier uses a **REST Hooks** pattern for triggers:

1. When a user enables a Zap trigger (e.g., "New completed document"), Zapier calls Seal's **subscribe** endpoint with a target URL
2. Seal stores that URL as a webhook subscription
3. When the event occurs, Seal pushes the payload to Zapier's URL (same as any other webhook delivery)
4. When the user disables the Zap, Zapier calls Seal's **unsubscribe** endpoint

For actions, Zapier calls Seal's existing REST API endpoints directly.

### User Flow

1. User opens Zapier and searches for "Seal" (the Zapier app)
2. Connects their Seal account by pasting an **API key** (generated in Seal's Settings > API Keys)
3. **Triggers** (Zapier polls or receives hooks):
   - "Document Sent" — fires when a document is sent for signing
   - "Document Completed" — fires when all recipients have signed
   - "Document Declined" — fires when a recipient declines
   - "Recipient Signed" — fires when an individual recipient signs
   - "Recipient Viewed" — fires when a recipient opens the signing page
4. **Actions** (Zapier calls Seal's API):
   - "Create Document from Template" — creates a new document from a template ID, with recipient data
   - "Send Document" — sends a draft document for signing
   - "Add Recipient" — adds a recipient to an existing draft document
5. No new Seal UI is needed — users manage everything from Zapier's interface

### Backend Implementation

#### Three New HTTP Endpoints

All under `/api/v1/zapier/`, authenticated via API key in the `Authorization` header (reuses existing `apiHttpAction` middleware).

**1. `POST /api/v1/zapier/subscribe`**

Zapier calls this when a user enables a trigger.

```
Request body:
{
  "hookUrl": "https://hooks.zapier.com/hooks/standard/...",
  "event": "document.completed"   // The trigger event type
}

Response:
{
  "id": "<webhook_subscription_id>"
}
```

Implementation:

- Creates a record in the existing `webhooks` table (or a new `webhook_subscriptions` table if the existing schema doesn't fit)
- Sets `source: "zapier"` to distinguish from user-created webhooks
- Sets `secret: null` — Zapier hooks don't need HMAC signing (Zapier trusts the registered URL)
- Subscribes only to the single requested event

**2. `DELETE /api/v1/zapier/subscribe/{subscriptionId}`**

Zapier calls this when a user disables a trigger.

```
Response: 204 No Content
```

Implementation:

- Deletes the webhook subscription record
- Validates the subscription belongs to the authenticated org

**3. `GET /api/v1/zapier/list-documents`**

Zapier calls this to populate the trigger editor with sample data. Users see real document data when configuring their Zap, which helps them map fields correctly.

```
Query params:
  limit: number (default 5)

Response:
{
  "documents": [
    {
      "id": "...",
      "title": "Employment Agreement",
      "status": "completed",
      "createdAt": "2026-02-20T...",
      "completedAt": "2026-02-22T...",
      "recipients": [
        { "name": "Jane Doe", "email": "jane@example.com", "status": "signed" }
      ]
    }
  ]
}
```

Implementation:

- Returns the most recent documents for the authenticated org
- Uses existing document queries with a limit
- Formats response to match the webhook payload shape (so Zapier field mapping is consistent)
- **If no documents exist yet** (new org), return a synthetic sample document with realistic placeholder data so Zapier's field mapper can still work. Zapier requires at least one sample object to display fields in the trigger editor.

#### Webhook Delivery for Zapier

Zapier subscriptions are delivered through the **existing webhook delivery system**:

1. When a document event fires (e.g., `document.completed`), the existing event dispatcher queries all active webhook subscriptions for that org and event type
2. For Zapier subscriptions (`source: "zapier"`), the payload is sent without HMAC signature headers (Zapier doesn't verify them)
3. Retry logic is the same as regular webhooks: 3 attempts with exponential backoff
4. If Zapier returns a **410 Gone** response, automatically delete the subscription (Zapier convention for deactivated hooks). **Important**: 410 responses should NOT trigger retries — mark the subscription as deleted immediately and stop delivery. Add a check in the retry logic to skip retries when the response status is 410.

#### Zapier Actions (Existing API Endpoints)

These already exist or are straightforward extensions of the current REST API:

| Zapier Action                 | Seal Endpoint                              | Status                        |
| ----------------------------- | ------------------------------------------ | ----------------------------- |
| Create Document from Template | `POST /api/v1/documents` with `templateId` | May need `templateId` support |
| Send Document                 | `POST /api/v1/documents/{id}/send`         | Exists                        |
| Add Recipient                 | `POST /api/v1/documents/{id}/recipients`   | Exists                        |

If any action endpoints are missing, they should be added to the existing API v1 routes following the established pattern in `apps/backend/convex/api/v1/`.

### Schema Changes

#### Modify: `webhooks` (or `webhook_subscriptions`)

```typescript
// Add to existing webhook schema
source: v.optional(v.union(
  v.literal("user"),      // Default — manually created webhooks
  v.literal("zapier"),    // Zapier REST Hook subscriptions
)),
```

**Decision: Use a separate `zapier_subscriptions` table.** The existing `webhooks` table stores endpoint URLs with shared secrets and subscribes to multiple events per record. Zapier subscriptions are fundamentally different: single-event, no HMAC secret, auto-cleanup on 410. Overloading the webhooks table would add conditionals throughout the delivery system. A separate table is cleaner:

```
zapier_subscriptions:
  organizationId: Id<"organizations">
  hookUrl: string                    // Zapier's callback URL
  event: string                      // Single event type
  apiKeyId: string                   // Which API key created this
  createdAt: number

  Indexes: by_organization, by_organization_event
```

The event dispatcher must query both `webhooks` and `zapier_subscriptions` tables when dispatching events.

### Zapier App Configuration

The Zapier app is configured entirely on Zapier's Developer Platform (https://developer.zapier.com). No Zapier-specific code lives in the Seal repo.

Zapier app definition includes:

- **Authentication**: API Key type. User pastes their Seal API key. Zapier sends it as `Authorization: Bearer <key>`.
- **Test endpoint**: `GET /api/v1/zapier/list-documents` — Zapier calls this to validate the API key works.
- **Triggers**: Each trigger maps to a subscribe/unsubscribe endpoint pair + a `list-documents` polling fallback.
- **Actions**: Each action maps to a Seal REST API endpoint with field definitions for the Zapier form builder.

### Permissions

- Zapier inherits the **API key's scopes** — no new permissions needed
- Triggers require `seal:webhooks:manage` scope (to create subscriptions)
- Actions require the relevant scope (e.g., `seal:documents:write` for creating documents)
- API keys are already scoped per organization

### Plan Gating

| Feature            | Free | Pro |
| ------------------ | ---- | --- |
| Zapier integration | No   | Yes |

Zapier access requires Pro plan and API key access (which is already Pro-gated). The subscribe endpoint should check plan status and return 403 for free orgs.

### What We Skip (v1)

- No OAuth authentication flow (API key only) — OAuth can be added later for a smoother Zapier UX
- No Zapier "Search" step (e.g., "Find document by title") — only triggers and actions
- No per-field template mapping in Zapier (recipients only, not document field pre-fill)
- No bulk operations via Zapier (one document at a time)
- No Make.com (Integromat) or n8n integration — same REST Hooks pattern could be reused later
- No custom Zapier trigger for "Field value changed" or other granular events
- No rate limiting specific to Zapier (uses the same API rate limits)

### Key Files to Modify/Create

| File                                         | Action                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `apps/backend/convex/api/v1/zapier.ts`       | Create — subscribe, unsubscribe, list-documents endpoints             |
| `apps/backend/convex/api/index.ts`           | Modify — register Zapier routes                                       |
| `apps/backend/convex/schemas/webhooks.ts`    | Modify — add `source` field (or create `zapier_subscriptions` schema) |
| `apps/backend/convex/schema.ts`              | Modify — register new table if needed                                 |
| `apps/backend/convex/webhooks/delivery.ts`   | Modify — handle 410 Gone cleanup, skip HMAC for Zapier hooks          |
| `apps/backend/convex/webhooks/dispatcher.ts` | Modify — query Zapier subscriptions alongside regular webhooks        |
