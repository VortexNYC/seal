# Competitor Analysis: Agree.com (March 2026)

**Date**: 2026-03-12
**Subject**: Agree.com full site rebrand & product pivot (launched ~2026-03-06)
**Analyst**: Shlomo Kabareti / Claude + Codex (independent verification)

---

## Executive Summary

Agree raised ~$10.2M total ($3M pre-seed + $7.2M seed per TechCrunch May 2025 — their homepage rounds up to "$11M"). They pivoted from a simple e-signature tool to a **"Contract-to-Cash" platform** — combining agreements, billing, payments, recovery, and reporting under one roof with 6 "AI agents" (really automation modules with agent branding). Growth tier at **$599/mo**, Enterprise custom.

Their homepage claims "75,000+ teams" — but the TechCrunch article (May 2025) said "over 25,000 users." The enterprise logo wall (Google, Meta, Amazon, etc.) has no third-party verification of broad deployment vs. isolated usage.

**Agree is a real product, not vapor. But the social proof is inflated.**

**Seal's opportunity**: Own the signer-first market. Startups, SMBs, freelancers, and regular users who need e-signatures + AI contract review + payments at $0-15/mo.

---

## Agree Product Map (Post-Rebrand)

### 1. Agreements (E-Signatures)

- E-signatures (free tier)
- Basic + advanced templates
- Redlining & negotiation (Growth+)
- Clause library (Growth+)
- Sequential & parallel signing
- Real-time collaboration on contracts
- Inline comments / @mentions
- Version history
- Approval / negotiation workspace
- CRM field auto-population into contracts
- Audit trail

### 2. Billing

- Auto-generate invoices from signed contracts
- Recurring billing schedules (weekly, monthly, custom)
- Usage-based invoicing
- Custom billing schedules
- Payment links embedded in invoices
- Accounting software sync (QuickBooks, Xero, NetSuite, Sage)

### 3. Payments

- Embedded payments (card, ACH, bank)
- Auto-charge on saved payment methods
- Payment surcharges (pass fees to customer)
- Subscription/recurring payments
- Real-time payment tracking
- Payment link generation
- Multi-currency (enterprise tier)

### 4. Recovery (Dunning)

- Automated payment reminders
- Smart dunning sequences
- Adaptive escalation
- AI agent that sends follow-up messages
- Failed payment retry logic
- Real-time overdue detection
- Stalled invoice detection
- Collection analytics

### 5. Reporting

- Live ARR / MRR dashboards
- DSO (Days Sales Outstanding) tracking
- Cash flow forecasting (30/60/90 day)
- Churn metrics
- Revenue pipeline visibility
- Aging dashboard
- Concentration risk analysis
- Real-time (not batch)

### 6. Integrations

- HubSpot (CRM, bidirectional)
- Salesforce (CRM, bidirectional)
- QuickBooks (accounting, with PDF sync)
- Xero
- NetSuite
- Sage
- Slack (notifications)
- Webhooks (all events)
- REST API with docs
- Integration health monitoring

### 7. AI Agents (6 named agents — really automation modules with agent branding)

| Agent            | Function                                       | Reality Check            |
| ---------------- | ---------------------------------------------- | ------------------------ |
| Signature Agent  | Triggers billing/payment at contract sign      | Workflow trigger, not AI |
| Billing Agent    | Schedules & generates recurring invoices       | Automation, not AI       |
| Collection Agent | Charges saved methods, manages subscriptions   | Payment processor logic  |
| Recovery Agent   | Pursues overdue revenue with reminders/retries | Dunning automation       |
| Reconcile Agent  | Keeps payments and books in sync               | Integration sync         |
| Insight Agent    | Surfaces ARR, MRR, DSO, cash flow in real time | Dashboard/reporting      |

**Codex assessment**: "Real contract-to-cash automation, but the '6 AI agents' look more like repackaged workflow modules than six independently differentiated AI products."

### 8. Solutions Pages (Persona-Based)

- Finance leaders
- Sales leaders
- Revenue Operations
- Founders & CEOs

### 9. Pricing

| Tier       | Price   | Users     | Key Features                                                               |
| ---------- | ------- | --------- | -------------------------------------------------------------------------- |
| Starter    | $0/mo   | 2         | E-signatures, basic templates, basic reporting                             |
| Growth     | $599/mo | 10        | Unlimited agreements, billing, payments, recovery, integrations, analytics |
| Enterprise | Custom  | Unlimited | Custom workflows, API, SSO, SLA, dedicated AM                              |

**Note**: API access appears gated to Enterprise tier despite strong developer marketing.

### 10. Social Proof — UNVERIFIED

- Claims "75,000+ teams" (TechCrunch May 2025 said 25K users — 3x inflation in ~10 months or metric change from users→teams)
- Logos: Google, Deel, Perplexity, Anthropic, Rippling, retired provider, Meta, Amazon, Rho, Beehiiv
- No third-party verification of broad enterprise deployment
- Real testimonials: Mat Sherman (VP Sales, Product Hunt), Tyler Denk (CEO, Beehiiv), Sasha Orloff (CEO, Puzzle)
- Awards: Money 20/20 2x Bronze, Product Hunt Product of the Day/Week, SOC 2 Type II
- TechCrunch press banner links to May 2025 article (not a new article for the rebrand)

### 11. Developer Experience

- REST API with quick start guides
- Bearer token auth
- Webhook subscriptions (all events)
- API docs: Invoices, Agreements, Contacts, Webhooks
- Embeddable payment links
- **Inconsistency**: Developer page pushes strong API story, but pricing gates API to Enterprise

### 12. Company Intel

- Founded: February 2024
- Launched: September 2024
- Team: ~7 employees
- Funding: $3M pre-seed + $7.2M seed = ~$10.2M total
- Founders previously sold companies to Twitter, Eventbrite, Brex
- Revenue model: Transaction fees on payment volume (e-signatures free)
- Site built on: Framer (marketing), secure.agree.com (app)

---

## Seal Product Map (Current)

### 1. Agreements (E-Signatures)

- E-signatures (draw, type, upload) -- FREE
- Templates with pre-configured fields
- 8 field types: signature, text, number, date, checkbox, dropdown, radio, attachment, payment
- Sequential & parallel signing with order groups
- Dictate next signer (sequential mode)
- Placeholder recipients
- Document expiration & deadlines
- Custom redirect URLs after signing
- QR code verification on completion
- iFrame SDK embedding

### 2. Payments (retired provider Connect)

- One-time payments
- Recurring billing (week/month/year intervals)
- Installment plans (split into N payments)
- Deposit + balance payments
- Payment line items with quantities
- Tax support (inclusive/exclusive)
- Multi-currency (ISO 4217)
- Fee handling (absorb or pass to recipient)
- Multiple payment methods: card, ACH, Apple Pay, Google Pay, Link
- Late fee configuration (percentage or fixed)
- Due date terms (on receipt, net 15/30/60, custom)
- retired provider Connect for payouts

### 3. AI Features

- AI document analysis (one-click)
- Field detection & auto-placement (position, type, label)
- Payment term extraction from contract text
- Document redlining/annotations (obligation, payment, risk, dates, terms)
- Severity classification (informational, important, critical)
- Show/hide AI annotations for signers
- Cross-document search
- Conversational AI threads per document (Seal Agent)
- AI auto-analyze on upload (configurable)

### 4. Invoicing

- Auto-generated invoices from payment fields
- Invoice status tracking (draft, open, paid, void, uncollectible)
- Hosted invoice URLs
- Invoice PDF generation

### 5. Notifications & Reminders

- Automated signing reminders (configurable schedule: e.g., 3, 7, 14 days)
- Expiration alerts (configurable days before)
- Email notifications: shared, signed, completed, declined, reminder
- Email delivery tracking (Resend)

### 6. Webhooks & API

- 17 webhook event types
- HMAC-SHA256 signing
- Exponential backoff retry
- Auto-disable after 10 failures
- API key management
- Connected app OAuth

### 7. Compliance & Audit

- ESIGN Act + UETA compliant
- SHA-256 document & signature hashing
- Full immutable audit trail (26 action types)
- IP + user agent + timestamp on every action
- 7-year retention
- Data export (GDPR/CCPA)

### 8. Organization & Team

- Workspace roles (owner, admin, member)
- Custom branding (logo, colors, email)
- Security settings (IP allowlist, MFA, session timeout)
- Contact management (CRM-lite)

### 9. Pricing

| Tier | Price               | Key Features                                                  |
| ---- | ------------------- | ------------------------------------------------------------- |
| Free | $0/mo               | 5 docs/month, unlimited recipients, audit trail, PDF download |
| Pro  | $15/mo ($12 annual) | Unlimited docs, team workspaces, templates, payments, API     |

---

## Gap Analysis: What Agree Has That Seal Doesn't

### CRITICAL GAPS (They have it, we don't, and it matters for our market)

| #   | Feature                                  | Agree                                                                            | Seal                                                           | Impact                                                                                                                 | Priority |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Redlining / negotiation**              | Built-in contract editing, tracked changes, comments, @mentions, version history | AI annotations only (read-only)                                | HIGH — biggest product disqualifier in B2B workflows. If we lose before signature, payment flexibility doesn't matter. | P0       |
| 2   | **Auto-invoicing from signed contracts** | Billing agent auto-generates invoices at signature                               | Manual — payment fields must be pre-configured                 | HIGH — "sign and get paid" is their core pitch                                                                         | P1       |
| 3   | **Clause library**                       | Reusable clause snippets                                                         | None                                                           | MEDIUM — templates partially cover this                                                                                | P2       |
| 4   | **Recurring invoice scheduling**         | Automatic schedule from contract terms                                           | retired provider recurring exists but no invoice UI/automation | MEDIUM — we have recurring payments, need the invoice layer                                                            | P2       |
| 5   | **Payment recovery / dunning**           | Automated reminders, retries, stalled invoice detection, collection analytics    | None — no dunning system                                       | MEDIUM — matters more as users scale                                                                                   | P2       |
| 6   | **Accounting sync**                      | QuickBooks, Xero, NetSuite, Sage                                                 | None                                                           | MEDIUM — SMBs live in QuickBooks                                                                                       | P2       |
| 7   | **Real-time collaboration**              | Inline comments, @mentions, version history in agreements                        | None                                                           | MEDIUM — expected in modern B2B tools                                                                                  | P2       |
| 8   | **CRM sync**                             | HubSpot + Salesforce bidirectional, CRM auto-population                          | None                                                           | LOW for our market — startups/SMBs use less CRM                                                                        | P3       |
| 9   | **Revenue reporting dashboard**          | ARR, MRR, DSO, cash flow, aging, concentration risk                              | None — no analytics UI                                         | LOW — nice differentiator but not launch-blocking                                                                      | P3       |
| 10  | **Slack notifications**                  | Real-time Slack alerts                                                           | None                                                           | LOW — easy to add via webhooks                                                                                         | P3       |
| 11  | **Developer docs site**                  | Full API docs with quick start, auth guides (but gated to Enterprise)            | OpenAPI spec exists, docs pages exist but limited              | MEDIUM — devs are a Seal audience, and our API is available at Pro                                                     | P2       |

### WHAT SEAL HAS THAT AGREE DOESN'T

| #   | Feature                                               | Details                                                                                                                                                                                            | Defensibility                                                                                                                                                                      |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **AI helps signers understand risk before execution** | Seal's AI flags obligations, risks, payment terms, and critical clauses for the SIGNER before they sign. Agree's AI is focused on post-signature automation (billing, collection, reconciliation). | STRONG — but don't claim "Agree has no AI before signing" (they use AI in agreement setup/extraction). Claim: "Seal's AI is signer-facing — it helps YOU understand the contract." |
| 2   | **40x lower starting price**                          | $15/mo vs $599/mo for unlimited docs + payments.                                                                                                                                                   | STRONG — but qualify as "starting price" since scope differs.                                                                                                                      |
| 3   | **5 free docs/month**                                 | Agree's free tier is 2 users, basic templates only. No payments.                                                                                                                                   | STRONG                                                                                                                                                                             |
| 4   | **Installment plans**                                 | Split payments into N installments — Agree doesn't mention this.                                                                                                                                   | STRONG                                                                                                                                                                             |
| 5   | **Deposit + balance**                                 | Initial deposit with balance due later — unique to Seal.                                                                                                                                           | STRONG                                                                                                                                                                             |
| 6   | **Apple Pay / Google Pay / Link**                     | 5 payment methods vs Agree's card/ACH/bank.                                                                                                                                                        | MODERATE — matters for consumer-facing use cases                                                                                                                                   |
| 7   | **iFrame SDK embedding**                              | Embed signing in any app — Agree has payment links but no signing embed.                                                                                                                           | STRONG                                                                                                                                                                             |
| 8   | **QR code verification**                              | Physical verification of completed documents.                                                                                                                                                      | MODERATE                                                                                                                                                                           |
| 9   | **Dictate next signer**                               | Dynamic signing order — current signer picks who's next.                                                                                                                                           | MODERATE                                                                                                                                                                           |
| 10  | **ESIGN consent tracking**                            | Per-recipient consent with opt-out — stronger compliance story.                                                                                                                                    | STRONG                                                                                                                                                                             |
| 11  | **IP allowlisting at $15/mo**                         | Enterprise security feature available in Pro.                                                                                                                                                      | STRONG                                                                                                                                                                             |
| 12  | **API available at $15/mo**                           | Agree gates API to Enterprise tier. Seal includes it in Pro.                                                                                                                                       | STRONG — major developer advantage                                                                                                                                                 |

### CLAIMS TO STOP MAKING

- ~~"Agree doesn't have AI before signing"~~ — Too strong. They use AI in agreement setup. Better: "Seal's AI is signer-facing — it helps you understand risk before you sign."
- ~~"Payments in the document" as unique~~ — Agree also does sign-and-pay embedded flow. Better: "Flexible payment structures (installments, deposits, 5 methods) built into the signing flow."
- ~~"40x cheaper"~~ without qualifier — True on headline but misleading on scope. Better: "40x lower starting price."

---

## Strategic Assessment

### Where Agree Is Going

They're building the **"retired provider for contracts"** — a revenue operations platform. Their moat is the contract-to-cash pipeline: sign a contract, auto-generate invoices, collect payments, chase overdue, reconcile books, report metrics. All automated by workflow modules marketed as AI agents.

**Their bet**: Mid-market companies ($1M-$100M annual volume) will pay $599/mo to automate their entire revenue cycle.

**Their real threat** (per Codex): Not "better signatures." It's **category expansion** — free signatures to get in, then upsell into billing, collections, reporting, CRM/accounting sync. The risk is Seal gets typecast as "cheap signing + payment widget" while Agree captures the higher-value B2B workflow buyer.

### Where Seal Should Go

Own the **signer-first contract and payment platform**. Seal is for people who:

- Can't afford $599/mo (or even $25/mo for DocuSign)
- Want AI that helps them **understand the contract before they sign**
- Need flexible payment structures built into the signing flow
- Want to embed signing anywhere (iFrame SDK)
- Are startups, freelancers, SMBs, or regular humans

### Seal's Positioning (Sharpened)

**Old**: "The DocuSign alternative with AI built in"
**New**: "The signer-first contract and payment platform."

Key pillars:

1. **AI helps you understand before you sign** — Risk flags, obligation highlights, payment term extraction. Nobody else focuses AI on the signer's experience.
2. **Flexible payments built into signing** — Installments, deposits, 5 payment methods, late fees. Not a separate invoice — the payment IS the document.
3. **40x lower starting price** — $15/mo vs $599/mo. API included. No enterprise gating.
4. **Free forever tier** — 5 docs/month, no credit card, full audit trail.
5. **Embed anywhere** — iFrame SDK for signing in any app.

---

## Build Roadmap (Finalized 2026-03-12)

Each feature ships as its own branch/PR. No breaking main. Surgical.

### Phase 1 — XS: This Week

| #   | Feature                   | Size | Notes                                                                                                                        |
| --- | ------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Slack notifications**   | XS   | Pre-built webhook template. Config page + Slack incoming webhook URL.                                                        |
| 2   | **Developer docs polish** | XS   | Content work. OpenAPI spec + docs pages exist, need polish + examples. API at Pro = advantage over Agree (Enterprise-gated). |

### Phase 2 — S: Next Week

| #   | Feature                          | Size | Notes                                                                                                           |
| --- | -------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| 3   | **Auto-invoice on signature**    | S    | document.completed → retired provider invoice from payment fields. Convex mutation. We're 80% there.            |
| 4   | **Payment recovery / dunning**   | S    | 3-email overdue sequence. Convex cron + Resend. Not an AI agent — just automation.                              |
| 5   | **Recurring invoice scheduling** | S    | Convex cron → invoice generation per contract schedule. We have retired provider recurring, need invoice layer. |
| 6   | **Revenue dashboard**            | S    | Aggregate existing invoice/payment data. Query + render. Data already exists.                                   |
| 7   | **Collection analytics**         | S    | Aging dashboard, stalled invoice detection. Extension of revenue dashboard.                                     |

### Phase 3 — M: Week 3-4

| #   | Feature             | Size | Notes                                             |
| --- | ------------------- | ---- | ------------------------------------------------- |
| 8   | **Clause library**  | M    | New table, CRUD UI, insert-into-template flow.    |
| 9   | **Version history** | M    | Document snapshots, diff UI. New table + storage. |

### Phase 4 — L/XL: Week 5-8

| #   | Feature                                   | Size | Notes                                                                                  |
| --- | ----------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| 10  | **Real-time collaboration**               | L    | Inline comments, @mentions, notification plumbing. Convex real-time is built for this. |
| 11  | **Redlining / collaborative negotiation** | XL   | Full tracked-changes editor. Biggest product gap, needs architecture.                  |

### Phase 5 — Integrations: After

| #   | Feature                | Size | Notes                                             |
| --- | ---------------------- | ---- | ------------------------------------------------- |
| 12  | **QuickBooks sync**    | M    | #1 SMB integration. OAuth + invoice/payment sync. |
| 13  | **HubSpot sync**       | M    | Contact/deal bidirectional sync.                  |
| 14  | **Xero/NetSuite/Sage** | L    | Each is separate. NetSuite is painful.            |

### Don't Build (Agree's Territory, Not Ours)

- Recovery AI agents (overkill for SMBs)
- Usage-based billing (enterprise feature)
- CRM bidirectional sync with Salesforce (our users don't have it)
- Cash flow forecasting (our users check their bank account)
- Concentration risk analysis (enterprise reporting)

---

## Key Takeaway

Agree is real but inflated. They went upmarket and their social proof is softer than it looks (25K users in May 2025 → claiming 75K teams in March 2026, unverified enterprise logos). Their "6 AI agents" are automation modules with agent branding, not six distinct AI products.

The real danger is category expansion: they use free signatures as a wedge, then upsell into a full revenue-ops stack. The defense is to own the signer-first experience — AI that helps the signer, flexible payments in the flow, developer-friendly API at $15/mo, and the negotiation tools (redlining) that prevent losing the deal before it gets to payment.

Redlining is the single highest-priority build. Everything else follows.
