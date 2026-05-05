# Agreement Review with AI — Design Proposal

**Status:** proposal
**Date:** 2026-05-05 (revised same day after first review)
**Author:** initial draft from session work

## What Seal is, in one sentence

Seal is the platform two or more parties use to **understand, negotiate, sign, and pay
for an agreement** — any agreement. Vendor contracts, employment offers, NDAs, real
estate, services, leases, equipment purchase, partnership terms, settlement papers,
license deals, sublease, anything where two sides need to commit to terms and
execute.

Seal is **not** a legal practice tool. Lawyers use it like everyone else; they're
not the audience. The audience is **anyone with an agreement to execute**.

The lifecycle Seal owns end-to-end:

```
[draft]  →  [understand]  →  [negotiate]  →  [sign]  →  [pay]
            └──────── this proposal ────────┘
            (the gap before signature today)
```

Seal already nails [sign] (recipient signing E2E lands as of #199) and [pay] (Stripe
Connect, billing, portal — covered through #198). This proposal addresses
**[understand]** and **[negotiate]** — the surface that exists today as
"upload a PDF and trust your gut."

## Two strict product rules

These two are non-negotiable and shape the rest of the design:

### 1. Documents are immutable PDFs. Seal never edits PDF text.

External tools (Word, Google Docs, Adobe Acrobat) are where text editing happens.
A new revision means a **new PDF upload**, which produces a **new version**.
This sidesteps the impossible "edit PDF text" problem and avoids competing with
real document editors — that's not a fight Seal wins.

### 2. "Editing" in Seal means annotation, not text editing.

Seal still lets users add things **on top of** the PDF — text boxes, signature
fields, date fields, checkboxes, the existing field-placement editor. That's
annotation, not text editing. The underlying PDF bytes never change. This stays
exactly as it works today.

## The opportunity

Every other doc-signing product (DocuSign, Adobe Sign, SignWell, Dropbox Sign)
treats the document as a black box. Upload, place fields, send, sign. The
buyer-of-the-product ("send it for me") is well-served. The receiving-party
experience and the pre-send review experience are essentially nothing.

In practice, both sides spend the most time on what's *in* the document. They
miss auto-renew clauses they didn't notice. They sign jurisdiction terms they
wouldn't have agreed to if they'd seen them. Counter-proposing a single clause
means a back-and-forth in email, manual revision in Word, re-uploading.

Seal can collapse that loop into the same surface where the doc lives.

## What we take from Mike (concept-only, no code)

[Mike](https://github.com/willchen96/mike) is an open-source legal-AI workspace,
AGPL-3.0. Reading the architecture is useful; lifting the code is not (license
+ stack mismatch). We take **concepts and patterns** and build them in our
stack.

| Mike concept | What we keep | What we drop |
|---|---|---|
| AI chat tied to a document | ✅ "Ask the agreement" — both sides can question the doc in plain English | — |
| Per-version chat threads | ✅ Each PDF version has its own thread; conversations on v1 don't pollute v2 | — |
| Suggestions as discrete database records (linked to the chat that produced them) | ✅ Structured concerns/questions traced back to the AI turn that surfaced them | — |
| Multi-LLM with tool use (Claude + Gemini) | ✅ Already partly here via Vercel AI Gateway env vars on `clever-goose-484` | — |
| Tracked-changes DOCX export with redlines | — | ❌ Implies Seal mutates document text. Violates rule #1. Not building this. |
| "Apply this AI suggestion to the doc" | — | ❌ Same — implies text editing. AI proposals stay as messages, not as edit operations |
| Project / matter / subfolder hierarchy | ✅ Already covered by Seal's existing `folders` table — just polish the UX | — |
| Built-in workflows labeled by legal practice area | — | ❌ Universal review prompts only. No practice-area framing |
| BYO Anthropic/Gemini key | — | ❌ Seal pays for inference; tier limits via existing subscription gates |
| Tabular review across N docs | ✅ Phase 6 (own design doc when we get there) | — |

## What we take from Catapult (code OK to lift — same org)

[Catapult](https://github.com/Catapult-Lighting-LLC/Catapult) is a sibling
Vortex project that already shipped document versioning. Pattern is in
`convex/schema.ts` and `convex/documents.ts`. We port it directly.

### Catapult's versioning pattern

**No separate `document_versions` table.** Versions are sibling rows in the same
`documents` table:

```ts
documents: defineTable({
  // ... existing fields ...

  // === Versioning ===
  version: v.number(),                          // starts at 1
  parentDocumentId: v.optional(v.id("documents")), // null for v1; points to v1 for v2+
  isLatestVersion: v.boolean(),                 // exactly one true per chain
})
  .index("by_org_and_latest", ["organizationId", "isLatestVersion"])
  .index("by_parent", ["parentDocumentId", "version"])
```

**Version-creation flow** (from Catapult's `documents.ts`):

```ts
const originalId = existing.parentDocumentId ?? existing._id;
const siblings = await ctx.db.query("documents")
  .withIndex("by_parent", q => q.eq("parentDocumentId", originalId))
  .collect();
const maxVersion = Math.max(existing.version, ...siblings.map(s => s.version));

await ctx.db.patch(existing._id, { isLatestVersion: false, ... });
for (const s of siblings.filter(s => s.isLatestVersion)) {
  await ctx.db.patch(s._id, { isLatestVersion: false, ... });
}

await ctx.db.insert("documents", {
  ...existing,                       // copy metadata
  storageId: newStorageId,           // new PDF blob
  version: maxVersion + 1,
  parentDocumentId: originalId,
  isLatestVersion: true,
  ...
});
```

**Why this fits Seal cleanly:**

- Three new optional columns on `documents`, no new table.
- Every existing FK to `documents._id` still works; the row it points to is now
  one specific version (which is correct — a signature was placed on a specific
  version of a specific PDF).
- All current queries keep working; add `.filter(isLatestVersion)` for "current view."
- Version-list query is a single index lookup.
- Backfill is mechanical: existing rows → `version: 1`, `isLatestVersion: true`,
  `parentDocumentId: undefined`.

We port this verbatim with a Seal-style migration.

## Folders — already exist, just expose them

Seal already has a `folders` table with `organizationId`, `name`, `parentId`
(recursive), `type` ("document" | "template"), `visibility`. Documents already
have a `folderId`. The grouping primitive is here.

What's missing is **UX exposure**:

- Users can name folders whatever they want — "Acme Deal Q4", "Smith Lease,"
  "Vendor Renewals 2026" — Seal stays opinion-free on taxonomy.
- Visible browse + drag/drop into folders.
- Pinning, bulk operations.

We **don't** introduce a "deal" or "project" or "matter" concept. The folder
is the container, named however the user wants. This is consistent with rule
#1 — the user knows their domain better than we do.

## User stories the surface unlocks

1. **Sender pre-send review.** Sender uploads a 14-page services agreement.
   Before clicking Send, they hit "Review with AI." The system flags concerns:
   60-day auto-renewal clause, $25k indemnification cap, jurisdiction in
   Delaware, late-fee terms, non-standard termination-for-convenience window.
   Sender reads the concerns, decides any matter, and can:
     - Send the doc as-is (acknowledging the concerns)
     - Open the chat thread and ask follow-up questions
     - Edit in their tool of choice and re-upload — that becomes v2

2. **Recipient pre-sign review.** Recipient gets the link, opens the doc, sees
   the same flagged-concern panel + their own chat thread. Asks "what's my
   termination notice?" Gets the clause pulled with a summary. Decides whether
   to sign or push back.

3. **Counter-proposal as message.** Recipient writes "I'd want indemnification
   raised to $100k. Can you revise?" — a message into the **shared thread**
   between the parties. Sender sees it on the doc, edits in their tool of
   choice, uploads v2. The recipient is notified that v2 is ready. Both see
   the version history.

4. **Version-scoped review.** v2 gets its own AI review and its own chat
   threads. v1's flagged concerns about indemnification are no longer relevant
   if v2 fixed it; v2's review verifies the fix and flags any new issues
   introduced. Old threads stay attached to old versions, immutable.

5. **Folder organization.** A workspace might have a folder called "Q4 Vendors"
   containing every agreement they're negotiating with vendors. Each agreement
   has its own version history. Folder is the unit of "deal" or "project" or
   whatever the user calls it.

## Architecture (Seal-native)

### Schema additions

#### Existing `documents` table — three new fields (Catapult pattern)

```ts
// Add to documentsTable
version: v.optional(v.number()),                   // starts at 1; optional during backfill
parentDocumentId: v.optional(v.id("documents")),   // null for v1; v1's _id for v2+
isLatestVersion: v.optional(v.boolean()),          // backfill all existing rows to true

// Add indexes
.index("by_org_and_latest", ["organizationId", "isLatestVersion"])
.index("by_parent", ["parentDocumentId", "version"])
```

Migration: backfill every existing row → `version: 1`, `isLatestVersion: true`,
`parentDocumentId: undefined`.

#### New: `agreement_reviews` — one row per AI review on a document version

```ts
{
  documentId: Id<"documents">,                     // points at the specific version row
  organizationId: Id<"organizations">,
  initiatedByUserId: v.optional(v.id("users")),
  initiatedByRecipientId: v.optional(v.id("document_recipients")),
  status: v.union("pending", "running", "ready", "failed"),
  modelUsed: v.string(),
  textHash: v.string(),                            // for action-cache idempotency
  summary: v.optional(v.string()),                 // top-level "what is this doc"
  flaggedConcernCount: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_document", ["documentId"])
.index("by_org_status", ["organizationId", "status"])
```

#### New: `agreement_concerns` — flagged items in a review

(Renamed from `agreement_suggestions` in v1 of this doc — they're concerns,
not text edits. We're not changing the document text.)

```ts
{
  reviewId: Id<"agreement_reviews">,
  documentId: Id<"documents">,                     // specific version
  organizationId: Id<"organizations">,
  category: v.union(
    "auto_renewal", "indemnification", "jurisdiction", "payment_terms",
    "termination", "liability_cap", "confidentiality", "ip_assignment",
    "non_compete", "other"
  ),
  severity: v.union("info", "caution", "blocker"),
  title: v.string(),                               // short label
  rationale: v.string(),                           // why it matters
  sourcePage: v.optional(v.number()),
  sourceSpan: v.optional(v.string()),              // text excerpt
  acknowledgedAt: v.optional(v.number()),          // sender saw + acknowledged
  acknowledgedByUserId: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_review", ["reviewId"])
.index("by_document", ["documentId"])
```

Note: no `proposedDeletion` / `proposedInsertion`. AI flags concerns; user
decides what to do (re-upload v2, ignore, message the counterparty).

#### New: `agreement_chats` — chat threads scoped to a document version

```ts
{
  documentId: Id<"documents">,                     // specific version row
  organizationId: Id<"organizations">,
  scope: v.union("private", "shared"),             // private = one party + AI; shared = both parties + optionally AI
  participantUserId: v.optional(v.id("users")),    // for private threads on the sender side
  participantRecipientId: v.optional(v.id("document_recipients")), // for private threads on the recipient side
  messageCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_document_scope", ["documentId", "scope"])
.index("by_document_user", ["documentId", "participantUserId"])
.index("by_document_recipient", ["documentId", "participantRecipientId"])
```

Three threads per version per session:
- **Sender's private thread** (just sender + AI)
- **Recipient's private thread** (just recipient + AI, exists once recipient opens link)
- **Shared thread** (sender + recipient, AI optional via @-mention or button)

#### New: `agreement_chat_messages`

```ts
{
  chatId: Id<"agreement_chats">,
  role: v.union("user", "assistant", "system"),
  authorUserId: v.optional(v.id("users")),
  authorRecipientId: v.optional(v.id("document_recipients")),
  content: v.string(),
  producedConcernIds: v.optional(v.array(v.id("agreement_concerns"))),
  // For shared-thread messages, the source private message that was published
  publishedFromMessageId: v.optional(v.id("agreement_chat_messages")),
  tokenUsage: v.optional(v.object({ input: v.number(), output: v.number() })),
  createdAt: v.number(),
}
.index("by_chat_created", ["chatId", "createdAt"])
```

### New Convex functions

- `documents.uploadNewVersion` (mutation) — Catapult-pattern version creation.
  Takes existing documentId + new storageId; produces a new row, demotes
  predecessors. Auto-fires `agreement_reviews.startReview` on the new version.
- `agreements.reviews.startReview` (action) — extract doc text via existing
  `extract_text_action.ts`, hit AI Gateway, write `agreement_reviews` +
  `agreement_concerns`. Action-cache keyed on `textHash`.
- `agreements.reviews.getReview` (query) — load review + concerns for a doc
  version.
- `agreements.concerns.acknowledge` (mutation) — sender marks a concern as
  read/handled. Doesn't change the doc. Just clears the badge.
- `agreements.chats.send` (action) — append a message to a thread, run AI
  turn if the thread includes AI, persist response.
- `agreements.chats.publishToShared` (mutation) — copy a private-thread
  message into the shared thread (the "share with the other side" button).

All reuse the existing infrastructure already in `convex.config.ts`:
`@convex-dev/agent` (chat memory), `@convex-dev/action-cache` (review
caching), `@convex-dev/workflow` (long-running review jobs),
`@convex-dev/rag` (handy for cross-doc analysis later).

### New web routes / UI

- **Version dropdown** in the doc editor header — switch between v1, v2, v3
  of the same agreement. Defaults to latest.
- **Version history sidebar** — list all versions with upload date, who
  uploaded, what changed (optional one-line description user types on
  re-upload), AI-summarized diff if we want to get fancy.
- **Review panel** — sidebar listing concerns by category. Click a concern
  to see the source page/excerpt highlighted in the PDF viewer.
- **Chat panel** — three tabs: "My notes" (private thread), "Shared with
  recipient" (shared thread), "AI" (AI-only thread for whoever opened it).
- **Recipient-side review panel** — same components, mounted on
  `/sign/{token}` behind a feature flag initially. Recipients can see
  shared thread + their own private thread + AI.
- **Folder browser** — polish the existing `folders` UI. User-named, no
  taxonomy imposed.
- **Pre-send review CTA** — Send button picks up an extra step. If the
  current version has any unacknowledged blocker-severity concerns, the
  modal lists them and asks the sender to either acknowledge or re-upload
  before sending.

## Phasing

Each phase is a separate PR. Each ships independently. Each one is testable
on the Mini E2E executor we built in #193 / #200.

### Phase 1 — Versioning (~1.5 weeks)

The foundation. Everything else scopes to a version, so this comes first.

- Schema: add `version` / `parentDocumentId` / `isLatestVersion` to
  `documents`. Backfill mutation for existing rows.
- Mutation: `uploadNewVersion` (Catapult pattern, ported with Seal idioms).
- UI: version dropdown in doc editor; history sidebar; "upload new version"
  button.
- E2E: create doc, upload v2, assert v2 is now isLatestVersion=true and v1
  is false; the recipient signing test still finds the latest version.

### Phase 2 — Doc chat (per version, private threads) (~1 week)

Cheapest valuable thing. Reuses the agent component.

- Tables: `agreement_chats`, `agreement_chat_messages`.
- Backend: extract doc text on demand, feed to agent component, persist
  messages. Scoped to (documentId, scope, participant).
- UI: chat panel in the doc editor + on the public sign page.
- E2E: ask "what's the termination notice?" on a doc, get a non-empty answer.

### Phase 3 — AI review with concerns (~1.5 weeks)

- Tables: `agreement_reviews`, `agreement_concerns`.
- Backend: structured-output prompt that returns flagged-concerns-with-rationale.
  Cached per `textHash` so re-running on the same version is free.
- UI: review panel sender-side + recipient-side (behind feature flag).
- Send-flow integration: Send button checks for unacknowledged blocker
  concerns, prompts the sender.
- E2E: create doc, run review, assert at least one concern exists, ack one,
  assert state.

### Phase 4 — Shared cross-party thread (~1 week)

- Add `scope: "shared"` chat support.
- "Share with the other side" button on private-thread messages
  (publishToShared mutation).
- Recipient-side UI for the shared thread.
- Notifications when the other side posts to the shared thread.

### Phase 5 — Folder UX polish (~1 week)

The schema is there. This is mostly UI work:
- Browse with drag/drop into folders
- Bulk operations
- Pinning, sorting
- Folder rename + nested folders properly exposed
- Visibility setting (everyone vs admin)

### Phase 6 (later, separate decision) — Cross-document tabular review

Org-level analytics. "What's our average payment window across all signed
vendor agreements?" Spreadsheet UI. Own design doc when we get there.

## Cross-cutting concerns

- **Cost.** AI inference goes on Seal's bill. Free tier gets N reviews +
  M chat messages per month. Pro unlimited. Enterprise via custom limits.
  Mirrors the existing `seedProSubscription` tier-based approach.
- **Privacy.** Document text only goes to the model provider via the AI
  Gateway, which has zero-data-retention turned on by default per Vercel
  docs. No fine-tuning on customer data. We surface this in plain language
  in the review settings panel.
- **Provider neutrality.** Vercel AI Gateway is provider-agnostic. We
  default to the best-available reasoning model and let pro accounts pick.
- **Audit trail.** Every review run, every concern acknowledgement, every
  chat message gets an audit entry. Existing `audit_logs` schema handles
  it; we add `review.*`, `concern.*`, `chat.message_sent` action literals.
- **Recipient-side AI cost.** Anonymous (token-based) recipients reviewing
  the doc cost Seal money the sender hasn't paid for directly. Initial
  gate: only enable recipient-side AI if the sending org's tier includes
  it. Recipient-side cost gets billed to the sender's org.
- **Feature flag.** Whole surface lives behind `agreements_ai` flag for
  the first few weeks of staging exposure. Gradual roll-out.
- **Versioning + signatures.** Once a version is signed, that version is
  locked. New uploads create yet another version which is a fresh
  un-signed document. The signed version stays as a permanent record.
  This matches how it actually works in the real world.

## Things this is explicitly NOT a design for

- **PDF text editing.** Seal never mutates PDF bytes. Edits happen in
  external tools, then the user uploads a new version.
- **Drafting from blank page.** Seal is for documents users already have.
- **Tracked-changes export (DOCX redline).** Implies Seal mutates document
  text. Out.
- **"Apply this AI suggestion."** Same — implies text editing. AI flags
  concerns; users decide and re-upload if they want to change anything.
- **Legal research / case law.** Out.
- **Compliance / privilege / UPL.** Lawyer-specific. Out.
- **Matter management.** Folders cover what most users need. We don't
  build a separate matter-or-deal hierarchy.

## Open questions

1. **Version diff summary.** When v2 lands, do we run an AI step that
   summarizes "here's what changed since v1" for both parties? Cheap to add,
   high signal. Probably yes — phase 2 or 3 add-on.
2. **Inheriting unanswered concerns across versions.** When v2 lands, do
   v1's unacknowledged concerns get carried forward as "still open?" Or
   does the new review subsume them? Lean toward subsume — v2's review
   should reflect v2's actual content, not v1's history.
3. **Cost ceiling per review.** Hard cap on input tokens to prevent a
   single 200-page doc from eating tokens. Suggest 100k input tokens with
   fail-soft "doc too long" message.
4. **Shared thread vs email reply.** Do we surface shared-thread messages
   via existing email notifications? Probably — recipients are used to
   email, not in-app messaging.

## Next concrete step

Once approved, build **Phase 1 — versioning — as the first PR.** Two-week
target. Catapult code is the reference; we port the schema + mutation, write
Seal-style tests, ship. Then Phase 2 (chat) on top. Each phase compounds
the next.
