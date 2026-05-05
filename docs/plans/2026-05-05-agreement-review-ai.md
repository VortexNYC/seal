# Agreement Review with AI — Design Proposal

**Status:** proposal
**Date:** 2026-05-05
**Author:** initial draft from session work

## What Seal is, in one sentence

Seal is the platform two or more parties use to **understand, negotiate, sign, and pay
for an agreement** — any agreement. Vendor contracts, employment offers, NDAs, real
estate, services, leases, equipment purchase, partnership terms, settlement papers,
license deals, sublease, anything where two sides need to commit to terms and execute.

Seal is **not** a legal practice tool. It is not built for lawyers as the audience.
Lawyers use it like everyone else. The audience is **anyone with an agreement to
execute**.

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

## The opportunity

Every other doc-signing product (DocuSign, Adobe Sign, SignWell, Dropbox Sign) treats
the document as a black box. Upload, place fields, send, sign. The buyer-of-the-product
("send it for me") is well-served. The receiving-party experience and the pre-send
review experience are essentially nothing.

In practice, both sides spend the most time on what's *in* the document. They miss
auto-renew clauses they didn't notice. They sign jurisdiction terms they wouldn't have
agreed to if they'd seen them. Counter-proposing a single clause means a back-and-forth
in email, manual track-changes in Word, re-uploading.

Seal can collapse that loop into the same surface where the doc lives.

## What we take from Mike (concept-only, no code)

[Mike](https://github.com/willchen96/mike) is an open-source legal-AI workspace, AGPL.
Reading the architecture is useful; lifting the code is not (license + stack mismatch
aside, the legal framing is wrong for Seal). We take **concepts and patterns** and
build them in our stack.

| Mike concept | What we keep | What we drop |
|---|---|---|
| AI chat tied to a document | ✅ "Ask the agreement" — both sides can question the doc in plain English | — |
| Suggested edits as discrete database records (before-text, after-text, change_id, link to chat that produced them) | ✅ Structured suggestions with approve/reject state, traced back to the AI turn that produced them | — |
| Tracked-changes export (DOCX redline) | ✅ Phase 3. Export a redlined version when negotiation closes | — |
| Tabular review across N docs | ✅ Phase 4 — org-level analytics ("what's our average payment terms across all signed vendor contracts") | — |
| Multi-LLM with tool use (Claude + Gemini) | ✅ Already partly here via Vercel AI Gateway env vars on `clever-goose-484` | — |
| Project / matter / subfolder hierarchy | — | ❌ Too legal-practice. Seal stays around the **agreement** as the unit, not "matters" |
| Built-in workflow library labeled by practice area (M&A, real estate, IP) | — | ❌ Universal review prompts only. No practice-area framing |
| BYO Anthropic/Gemini key | — | ❌ Seal pays for inference; tier limits via existing subscription gates |
| Tracked-changes data model — `change_id` + `del_w_id` + `ins_w_id` referring to Word doc internals | We keep the **idea** of structured edits | We don't keep the Word-XML coupling. Works for any input format |

## What we are NOT building (yet)

- **A drafting tool from a blank page.** Seal is for documents users already have.
  AI generation of contracts from scratch is a different product surface and competes
  with Ironclad / Spotdraft. Skip.
- **Legal research.** Seal doesn't read case law. The AI helps users understand a
  doc *they have*, not the legal landscape around it.
- **Compliance / privilege / UPL.** Lawyer-specific concerns. Out of scope.
- **Matter management.** Seal documents stay flat under an organization. No legal
  matter/case hierarchy.

## User stories the surface unlocks

1. **Sender pre-send review.** Sender uploads a 14-page services agreement. Before
   clicking Send, they hit "Review with AI." The system flags: 60-day auto-renewal
   clause, $25k indemnification cap, jurisdiction in Delaware, late-fee terms, and a
   non-standard termination-for-convenience window. Sender approves three suggested
   counter-edits, rejects two, leaves the rest. The doc updates in place. Then they
   place fields and send.

2. **Recipient pre-sign review.** Recipient gets the link, opens the doc, sees the
   "Ask the agreement" sidebar. Asks "what's my termination notice?" Gets the clause
   pulled out with a summary. Asks "is there anything I should be careful about?"
   Gets the same flagged-clause list the sender saw. Decides whether to sign.

3. **Counter-proposal.** Recipient sees the indemnification cap is too low, types
   "I'd want this raised to $100k." AI generates a redlined edit. Recipient sends
   the proposed edit back to the sender (no signature yet). Sender sees the
   suggestion in their existing dashboard, approves or rejects. Doc updates. Loop
   continues until both sides accept the final.

4. **Org-level read.** A team admin asks "across all our signed vendor contracts in
   the last year, what's the average payment-due window? What jurisdictions are most
   common? Which ones have unilateral price-increase clauses?" Seal produces a
   table. (Phase 4.)

## Architecture (Seal-native, not Mike-shaped)

### New Convex tables

Designed independently from Mike's Postgres schema. House style: camelCase fields,
`createdAt`/`updatedAt`, `organizationId` scoping, indexed by query patterns.

```ts
// agreement_reviews — one row per "AI review session" on a document version
{
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  initiatedByUserId: v.optional(v.id("users")),     // sender side
  initiatedByRecipientId: v.optional(v.id("document_recipients")), // recipient side
  status: v.union("pending", "running", "ready", "failed"),
  modelUsed: v.string(),                            // e.g. "claude-sonnet-4-7"
  textHash: v.string(),                             // for action-cache idempotency
  summary: v.optional(v.string()),                  // top-level "what is this doc"
  flaggedClauseCount: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_document", ["documentId"])
.index("by_org_status", ["organizationId", "status"])
```

```ts
// agreement_suggestions — one row per AI-flagged item or proposed edit
{
  reviewId: Id<"agreement_reviews">,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  // What the suggestion is about
  category: v.union(
    "auto_renewal", "indemnification", "jurisdiction", "payment_terms",
    "termination", "liability_cap", "confidentiality", "ip_assignment",
    "non_compete", "other"
  ),
  severity: v.union("info", "caution", "blocker"),
  title: v.string(),                                // short label
  rationale: v.string(),                            // why it matters
  // Where it points to in the document
  sourcePage: v.optional(v.number()),
  sourceSpan: v.optional(v.string()),               // text excerpt
  // What to change (optional — some items are flag-only)
  proposedDeletion: v.optional(v.string()),
  proposedInsertion: v.optional(v.string()),
  // State
  state: v.union("open", "accepted", "rejected", "superseded"),
  decidedAt: v.optional(v.number()),
  decidedByUserId: v.optional(v.id("users")),
  decidedByRecipientId: v.optional(v.id("document_recipients")),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_review", ["reviewId"])
.index("by_document_state", ["documentId", "state"])
```

```ts
// agreement_chats — chat thread per (document, party)
{
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  participantUserId: v.optional(v.id("users")),
  participantRecipientId: v.optional(v.id("document_recipients")),
  messageCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}
.index("by_document_participant_user", ["documentId", "participantUserId"])
.index("by_document_participant_recipient", ["documentId", "participantRecipientId"])
```

```ts
// agreement_chat_messages — individual messages in a chat
{
  chatId: Id<"agreement_chats">,
  role: v.union("user", "assistant", "system"),
  content: v.string(),
  // If the assistant turn produced one or more suggestions, point back
  producedSuggestionIds: v.optional(v.array(v.id("agreement_suggestions"))),
  tokenUsage: v.optional(v.object({ input: v.number(), output: v.number() })),
  createdAt: v.number(),
}
.index("by_chat_created", ["chatId", "createdAt"])
```

These tables live alongside the existing `documents`, `document_recipients`,
`signature_fields`, `audit_logs` schemas. New audit actions:
`review.started`, `review.completed`, `suggestion.accepted`, `suggestion.rejected`.

### New Convex functions

- `agreements.reviews.startReview` (action) — extract doc text, hit AI Gateway with
  the structured-output prompt, write `agreement_reviews` + `agreement_suggestions`
  rows. Goes through the existing `@convex-dev/agent` component for chat memory.
- `agreements.reviews.getReview` (query) — load review + suggestions for a doc.
- `agreements.suggestions.decide` (mutation) — accept/reject a suggestion;
  optionally apply the edit to the document text + bump
  `documents.currentVersionId`.
- `agreements.chats.send` (action) — append a message, run AI turn, persist
  response. Uses the same agent component.
- `agreements.exports.tracked` (action) — Phase 3. Generate a DOCX or PDF with
  redlines from accepted suggestions.

All of these reuse the existing infrastructure already in `convex.config.ts`:
`@convex-dev/agent`, `@convex-dev/action-cache`, `@convex-dev/workflow`,
`@convex-dev/rag` (handy for cross-doc analysis later).

### New web routes / UI

- **Review panel** — sidebar in the existing doc editor at
  `/{slug}/documents/{docId}`. Lists suggestions grouped by category, with
  approve/reject buttons. Reuses the field-placement editor's right-rail layout.
- **Chat panel** — toggleable, sits next to the review panel. Threaded chat with the
  agreement.
- **Recipient-side review panel** — same components, mounted on
  `/sign/{token}` behind a feature flag (initially) so recipients can see the
  same flagged items the sender saw, plus their own chat thread.
- **Pre-send review CTA** — the Send button picks up an extra step. If a review
  has flagged items in `state="open"`, the modal shows them and asks the sender
  to either resolve (accept/reject) or override before sending.

## Phasing

Each phase is a separate PR. Each ships independently. Each one is testable on the
Mini E2E executor we built in #193 / #200.

### Phase 1 — Doc chat (1 week)

- Tables: `agreement_chats`, `agreement_chat_messages`.
- Backend: extract doc text on demand (already have `documents/extract_text_action.ts`),
  feed to agent component, persist messages.
- UI: sidebar chat in the doc editor + on the public sign page.
- Test: E2E that asks "what's the termination notice?" gets a non-empty answer.
- Audit: `chat.message_sent` audit entries.

This is the cheapest valuable thing. Reuses every existing component. Validates
that the AI gateway / agent / cost model all hold up before we build redlining
on top.

### Phase 2 — Structured AI review with approve/reject (1.5 weeks)

- Tables: `agreement_reviews`, `agreement_suggestions`.
- Backend: structured-output prompt that returns flagged-clauses-with-rationales.
  Caches per `textHash` so re-running on the same doc is free.
- UI: review panel in the doc editor (sender side) and on `/sign/{token}` (recipient
  side, behind feature flag).
- Send-flow integration: Send button checks for unresolved blocker-severity
  suggestions, prompts the sender.
- Test: E2E that creates a doc, runs review, asserts at least one suggestion
  exists and accepting it transitions state to `accepted`.

### Phase 3 — Tracked-changes export (1 week)

- DOCX redline output for accepted edits.
- PDF redline output (use `pdf-lib` patterns we already use elsewhere).
- Triggered from a "Download redlined" action button.

This is the smallest of the three but the highest "ohh nice" value for users
who came from Word. We can ship Phase 1 + 2 without it; Phase 3 is a fast follow.

### Phase 4 — Cross-document tabular review (later, separate decision)

Org-level analytics across signed agreements. "What's our average payment window?
Which contracts have auto-renewals expiring in Q3?" Spreadsheet UI. Probably its
own design doc when we get there.

## Cross-cutting concerns

- **Cost.** AI inference goes on Seal's bill. Free tier gets N reviews / month
  (suggest: 3). Pro unlimited. Enterprise via custom limits. Mirrors the existing
  `seedProSubscription` tier-based approach.
- **Privacy.** Document text only goes to the model provider via the AI Gateway,
  which has zero-data-retention turned on by default per Vercel docs. No fine-tuning
  on customer data. We surface this in plain language in the review settings panel.
- **Provider neutrality.** Vercel AI Gateway is provider-agnostic. We default to
  the best-available reasoning model and let pro accounts pick (claude-sonnet-4-7,
  gemini-3-flash-preview, etc.).
- **Audit trail.** Every review run, every suggestion decision, gets an audit
  entry. Existing `audit_logs` schema handles it; we add `review.*` and
  `suggestion.*` action literals.
- **Recipient-side AI.** Anonymous (token-based) recipients reviewing the doc cost
  Seal money the sender hasn't paid for. Initial gate: only enable recipient-side
  AI review if the sending org is on a tier that includes it. Recipient-side
  cost gets billed to the sender.
- **Feature flag.** Whole surface lives behind `agreements_ai` flag for the first
  few weeks of staging exposure. Gradual roll-out.

## Open questions

1. **Editing the source PDF.** Right now Seal's documents are PDFs. Tracked-changes
   on a PDF is awkward — best UX is on the underlying text. Two options:
     - (a) Require uploads to be DOCX, convert to PDF for signing, keep DOCX as the
       source of truth.
     - (b) Keep PDF source, present suggestions as overlay edits, generate a
       redlined PDF on export.
   Phase 1 doesn't decide this; chat is read-only. Phase 2 does.
2. **Negotiation back-and-forth across parties.** When recipient counter-proposes,
   does the sender just see suggestions in the doc editor, or do we build a
   separate "review queue"? Lean toward the former for v1.
3. **Cost ceiling per review.** Hard cap to prevent a single 200-page doc from
   eating tokens. Suggest: 100k input tokens, fail-soft above that with a
   "doc too long" message.

## What this *isn't* a design for

- Drafting from blank page.
- Legal research / case law lookup.
- Matter management.
- Per-document role-based access. Existing `document_recipients` covers signing
  access; AI review uses the same access boundary.

## Next concrete step

After this doc gets reviewed, build **Phase 1 — doc chat — as a working spike**
on a fresh branch. Two days max to a green E2E that asks a doc a question and
gets a coherent answer back. Then iterate.
