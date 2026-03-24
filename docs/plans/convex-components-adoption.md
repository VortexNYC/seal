# Convex Components Adoption Plan

> Last updated: 2026-03-01
> Source: Full catalog from [convex.dev/components](https://convex.dev/components)

## Already Using (11 components)

| Component      | Package                      | Status                                                                                                                  |
| -------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AI Agent       | `@convex-dev/agent`          | Fully adopted — `sealAgent` in `ai/agent.ts`, threads, streaming, tools                                                 |
| RAG            | `@convex-dev/rag`            | Fully adopted — `documentRag` in `ai/search.ts`, hybrid search, ingestion                                               |
| Rate Limiter   | `@convex-dev/rate-limiter`   | Fully adopted — API rate limiting + AI chat anti-spam                                                                   |
| Action Cache   | `@convex-dev/action-cache`   | Fully adopted — `fieldAnalysisCache` wraps Gemini calls, 24h TTL                                                        |
| Action Retrier | `@convex-dev/action-retrier` | Fully adopted — `retrier.run()` for hashDocument + extractDocumentText                                                  |
| Aggregate      | `@convex-dev/aggregate`      | Fully adopted — `aiUsageAggregate` for token usage count/sum                                                            |
| Workpool       | `@convex-dev/workpool`       | Fully adopted — `aiPoolPro`/`aiPoolFree` for AI pipeline dispatch                                                       |
| Resend         | `@convex-dev/resend`         | Fully adopted — all 10+ email types via `sendEmailManually()`                                                           |
| Presence       | `@convex-dev/presence`       | Fully adopted — document detail page "who's viewing" avatars                                                            |
| Timeline       | `convex-timeline`            | Fully adopted — undo/redo for field editor with Ctrl+Z/Ctrl+Shift+Z                                                     |
| Migrations     | `@convex-dev/migrations`     | Registered but unused — `Migrations` instance exists, 0 `define()` calls                                                |
| Workflow       | `@convex-dev/workflow`       | Fully adopted — `postSignatureWorkflow` + `documentCompletionWorkflow` + `documentCancellationWorkflow` in `workflows/` |

## To Adopt — Confirmed List

### HIGH Priority

#### `@convex-dev/stripe` (v0.1.3)

Checkout sessions, subscription management, customer/org linking, webhook handling, seat-based pricing, real-time Convex queries for payment data.

**Seal use case:** Could replace our custom Stripe integration (webhooks in `webhooks.ts`, Connect logic in `stripe/`, subscription management). User confirmed: "no question."

**Key API:** `StripeSubscriptions` client, automatic webhook sync to Convex DB, checkout session creation, customer portal.

---

### MEDIUM Priority

#### `@convex-dev/persistent-text-streaming` (v0.3.0)

Stream text (LLM output) to browser via React hook while simultaneously persisting to DB. Text accessible after stream ends or by other users.

**Seal use case:** AI chat feature — could improve persistence of partial AI responses. Currently using `@convex-dev/agent` streaming which may already handle this; needs evaluation of overlap.

**Key API:** `createChatStream()`, `useChatStream()` React hook, `queryChatBody()` for persisted access.

---

#### `@convex-dev/crons` (v0.2.0)

Dynamic runtime cron registration (vs static `crons.ts` which requires redeployment). Standard cron expressions or interval in ms. CRUD operations on cron jobs.

**Seal use case:** Per-document reminder schedules (only create cron when reminders are enabled), per-org expiration sweep schedules — instead of one global cron checking everything every hour.

**Key API:** `crons.register()`, `crons.get()`, `crons.list()`, `crons.delete()`.

---

#### `@convex-dev/debouncer` (NEW — not in original audit)

Debounce expensive operations — only run after a period of inactivity. Built for LLM calls, metrics computation, heavy processing.

**Seal use case:** AI field analysis pipeline — avoid re-analyzing while user is still editing/adding fields. Currently any field change could trigger re-analysis immediately.

**Key API:** `debouncer.debounce(key, action, delayMs)`.

---

### LOW Priority

#### ~~`@convex-dev/presence` (v0.3.0)~~ — **ADOPTED** (2026-03-01)

---

#### `@convex-dev/migrations` (v0.3.1) — already registered

Batch processing with progress tracking, resume from failure, CLI or programmatic execution. Supports online/offline migrations.

**Seal use case:** Replace ad-hoc `internalMutation` loops in `organization_roles/migrations.ts` with proper tracked migrations. Already registered in `convex.config.ts`, just needs `migrations.define()` calls.

**Key API:** `migrations.define()`, `migrations.run()`, progress observation.

---

#### `@convex-dev/files-control` (NEW — not in original audit)

Secure file uploads, access control, download grants, lifecycle cleanup.

**Seal use case:** Could replace our manual storage cleanup scheduler (`cleanup.cleanupDocumentStorage` with 7-day grace period) and add proper download access control for signed PDFs.

---

#### ~~`convex-timeline` (v0.1.2)~~ — **ADOPTED** (2026-03-01)

Undo/redo for document field editor — Ctrl+Z/Ctrl+Shift+Z with timeline snapshots on every field mutation.

---

## Evaluated & Skipped

| Component        | Package                          | Why Skipped                                                  |
| ---------------- | -------------------------------- | ------------------------------------------------------------ |
| Better Auth      | `@convex-dev/better-auth`        | We use Clerk                                                 |
| WorkOS AuthKit   | `@convex-dev/workos-authkit`     | We use Clerk                                                 |
| Expo Push        | `@convex-dev/push-notifications` | No mobile app                                                |
| Twilio SMS       | `@convex-dev/twilio`             | No SMS feature planned                                       |
| Loops            | `@convex-dev/loops`              | We use Resend for emails                                     |
| LaunchDarkly     | `@convex-dev/launchdarkly`       | No feature flag infra yet — revisit if needed                |
| Geospatial       | `@convex-dev/geospatial`         | No location features                                         |
| Cloudflare R2    | `@convex-dev/cloudflare-r2`      | Convex storage sufficient for now                            |
| ConvexFS         | `@convex-dev/convex-fs`          | Same — revisit if storage limits become an issue             |
| OSS Stats        | `@convex-dev/oss-stats`          | Not relevant                                                 |
| Cloudinary       | `@convex-dev/cloudinary`         | No image processing needs                                    |
| Transloadit      | `@convex-dev/transloadit`        | No media processing pipeline                                 |
| Nano Banana      | `@convex-dev/nano-banana`        | AI image generation — not relevant                           |
| Browser Use      | `@convex-dev/browser-use`        | AI browser automation — not relevant                         |
| Firecrawl Scrape | `@convex-dev/firecrawl-scrape`   | Web scraping — not relevant                                  |
| Durable Agents   | `@convex-dev/durable-agents`     | Interesting but `@convex-dev/agent` already covers our needs |
| Neutral Cost     | `@convex-dev/neutralcost`        | Our `ai/usage.ts` + aggregate handles this already           |
| ProseMirror Sync | `@convex-dev/prosemirror-sync`   | Collaborative editing — not a current feature                |
| Sharded Counter  | `@convex-dev/sharded-counter`    | Aggregate component already covers our counting needs        |
| Autumn           | `@convex-dev/autumn`             | We use Stripe                                                |
| Polar            | `@convex-dev/polar`              | We use Stripe                                                |
| Dodo Payments    | `@convex-dev/dodopayments`       | We use Stripe                                                |

## Implementation History

| Date       | Component                    | Commit             |
| ---------- | ---------------------------- | ------------------ |
| 2026-02-28 | `@convex-dev/resend`         | `8f443c4`          |
| 2026-02-28 | `@convex-dev/rate-limiter`   | `076144e`          |
| 2026-03-01 | `@convex-dev/action-retrier` | `2f982b1`          |
| 2026-03-01 | `@convex-dev/workflow`       | _(pending commit)_ |
| 2026-03-01 | `@convex-dev/presence`       | _(pending commit)_ |
| 2026-03-01 | `convex-timeline`            | _(pending commit)_ |

## Recommended Implementation Order

1. ~~`@convex-dev/workflow`~~ — **DONE** (2026-03-01)
2. ~~`@convex-dev/stripe`~~ — **SKIPPED** (too much custom Stripe work to justify component swap)
3. ~~`@convex-dev/persistent-text-streaming`~~ — **SKIPPED** (`@convex-dev/agent` already handles persistent streaming via `saveStreamDeltas: true`)
4. ~~`@convex-dev/crons`~~ — **SKIPPED** (batch cron approach is architecturally better than per-document dynamic crons for our use case)
5. ~~`@convex-dev/debouncer`~~ — **SKIPPED** (package not published to npm yet — 404)
6. ~~`@convex-dev/presence`~~ — **DONE** (2026-03-01) — backend + frontend avatar UI on document detail page
7. ~~`@convex-dev/files-control`~~ — **SKIPPED** (package not published to npm yet — 404)
8. ~~`@convex-dev/migrations`~~ — **NO-OP** (already registered, ad-hoc migration scripts work fine as-is, formalizing adds tracking but no functional improvement)
