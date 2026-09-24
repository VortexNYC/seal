# ADR-004: Interaction Sessions and host HITL boundaries

## Status

Accepted (Seal producer shipped; Core package lift still open)

## Date

2026-09-24

## Context

Agents drive Seal (and soon Veil / Pile / payments) through API / MCP / CLI.
When a human must act — sign, approve, unlock a secret, pay — we need **one**
cross-product pattern so we do not invent a new handoff per host (Claude Code,
ChatGPT Apps, Grok Bot, Codex, raw CLI).

SEA-61 tracks the Core `InteractionSession` primitive. This ADR records what
platforms expect, what is consistent, what is host-specific, what not to do,
industry examples, and whether any open-source “Chat SDK for HITL” already
exists.

Related: ADR-003 (agents operate; humans sign intent). First Seal proof:
`seal wait --document <id> --open` (PR #722).

## Decision

### 1. Two workflows only

| ID | Name | Use for | Never use for |
| -- | ---- | ------- | ------------- |
| **A** | HTTPS interaction URL + poll (canonical) | Sign, pay, unlock secret, third-party OAuth, any credential or legally binding act | — |
| **B** | Form / in-host typed ask (secondary) | Non-sensitive clarifies: which template, confirm email, pick org | Passwords, API keys, signatures, payments |

Stop inventing a third primary path.

### 2. Canonical contract (Workflow A)

```ts
InteractionSession = {
  id: string
  kind: "sign" | "approve" | "unlock" | "pay" | string
  url: string // temporary human page (HTTPS)
  status: "pending" | "completed" | "cancelled" | "expired"
  result?: unknown // typed per kind
  expires_at: string
}
```

Flow:

```text
Agent → API creates work + InteractionSession
     → host shows or opens url
     → human completes one job on that page
     → agent polls (or receives completion signal) until terminal
     → resume with result
```

Maps 1:1 to MCP **URL-mode elicitation** (`elicitation/create` with
`mode: "url"`, `url`, `elicitationId`; optional
`notifications/elicitation/complete`).

### 3. Surfaces only differ in how the URL is shown

| Surface | Show URL | Continue |
| ------- | -------- | -------- |
| CLI | `open(url)` / print | poll |
| MCP (Claude Code, etc.) | URL elicitation or tool payload `interaction_url` | poll or elicitation complete |
| Chat / Grok / ChatGPT | markdown link (optional ChatGPT widget later) | poll tools |
| SDK | same objects; embed optional for in-product signers | poll / webhook |

### 4. Host tool permissions are not our product HITL

Claude Code permission modes, Grok Auto-review, ChatGPT destructive-action
confirms are **host gates** (bash, write, browser). Seal / Veil / Pile must not
reinvent them. Our HITL is the product act (sign / unlock / pay).

### 5. Three layers — do not mix them

This pattern is portfolio-wide (Seal, Veil, Pile, payments). Keep ownership clear:

| Layer | Owns | Examples | Not owned here |
| ----- | ---- | -------- | -------------- |
| **Core / InteractionSession** | Short-lived URL, one job, status, wait/poll, optional completion signal, pre-filled payload so human only acts | `id`, `url`, `status`, `result`, `expires_at`; MCP URL elicitation; `seal wait` | Nudges, cron, product cockpits |
| **Agent host / framework** | How the link is shown; whether to auto-open; reminding the human the agent is blocked; token spend on “hey you still need to do this” | Claude Code open URL; Grok Bot / Hermes / OpenClaw timers & pings | Product-specific inbox UX |
| **Product** | What the human page *is* (sign vs unlock vs approve); copy; legal/compliance; optional “needs me” overview if that product wants one | Seal signing page; Veil unlock page | Replacing host reminders |

**Universal (every Vortex product):** agent prepares → one clear human page → Done → agent resumes. Reduce friction between agent work and human act until it feels butter (pre-fill everything; human only signs intent / unlocks / approves).

**Product- or host-specific (do not put in Core):** AFK reminders, oversight “needs me” queues, channel choice (email vs iMessage vs Slack). Seal may care more about “blocked on signature”; an agent framework may own the nudge cron. Same InteractionSession either way.

### 6. Target feel

Agent did the work. Human sees one job. Signs / unlocks / approves. Tab can close. Agent continues. No forge, no cockpit, no second workflow.

### 7. How the human surface is *rendered* (not a new workflow)

Same InteractionSession; different skins depending on where the human is:

| Skin | What it is | When relevant |
| ---- | ---------- | ------------- |
| **HTTPS page** (canonical for sensitive) | Our short-lived URL | Sign, pay, unlock — always available |
| **Host chat UI / MCP Apps** | Interactive card *inside* Claude/ChatGPT | Packaging: status + Open; not the trust boundary for signatures |
| **TUI** (terminal UI) | Ink / Textual / Claude Code dialogs | Human is in a terminal host; form elicitation / confirm |
| **AG-UI / generative UI** (e.g. CopilotKit AG-UI, Google A2UI, mcp-ui) | Event stream so *someone’s* frontend can render agent state live | Building *our* oversight or embeddable agent UI — complementary to MCP, not a replacement for URL handoff |

Tokens for generative UI are paid by whoever runs that agent/app. Vortex products still own the sensitive act page. Do not invent a fourth primary workflow just because a nicer renderer exists.

North star for every skin: **minimum friction for agents *and* for the moment a human actually touches the UI** — across CLI, IDE, chat, and web.

## Platform expectations (research 2026-09-24)

| Host | Sensitive / binding | Non-sensitive | Notes |
| ---- | ------------------- | ------------- | ----- |
| **MCP spec** | URL-mode elicitation; secrets must not use form mode | Form-mode elicitation (flat JSON Schema) | SEP-1036 URL mode Final; client shows domain + consent |
| **Claude Code** | URL elicitation → system URL handler; confirm in CLI | Form dialog; `AskUserQuestion` | Official MCP client behavior |
| **ChatGPT Apps / Plugins** | MCP OAuth 2.1 to link app; host confirm for destructive writes; optional in-chat widgets (checkout partners) | Widgets / tools | Do not punch out to a Seal cockpit as primary |
| **Grok Bot** | Take computer control or secure secret request (masked, not in transcript); connector auth in browser | Approvals (Allow once / Deny / Always allow) | Shared Agent Computer |
| **CLI / headless** | Print or open URL | Prompt or skip | Poll only in CI |

Sources:

- https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation.md
- https://code.claude.com/docs/en/mcp.md
- https://developers.openai.com/apps-sdk/build/auth.md
- https://developers.openai.com/plugins/guides/security-privacy.md
- https://docs.x.ai/grok-bot/approvals-security-and-privacy.md

## What is consistent (centralize)

1. Sensitive data never transit the model / MCP client — out-of-band URL (or host-owned secure handoff).
2. Client job = consent + surface URL; server owns completion.
3. Poll and/or completion notification until terminal status.
4. One clear human job per page; then get out of the way.
5. Never forge the human act.

## What is platform-specific (adapters only)

- Auto-open vs paste link vs ChatGPT widget.
- Form elicitation UI chrome (Claude dialog vs ChatGPT widget vs Grok sheet).
- Host permission / Auto-review rules (out of Vortex product scope).
- URL length caps (Claude Code URL-handler arg escaping).

## Not to dos

- Localhost OAuth callback as primary (dies in cloud / headless agents).
- OAuth device flow for signing (device flow = login, not binding acts).
- Slack / email buttons as the **sync** “do this now” path (fine as async notify).
- In-chat / form elicitation for passwords, API keys, signatures, payments.
- Seal (or any product) cockpit as where agents work.
- One-off per-host handoff designs that diverge from `InteractionSession`.

## Industry examples to follow

| Pattern | Examples | Role for us |
| ------- | -------- | ----------- |
| Open URL + poll | DocuSign, Stripe Checkout, Plaid Link, Seal `signing_url` | **Canonical** |
| MCP URL elicitation | MCP SEP-1036, Claude Code URL mode | Wire mapping for MCP hosts |
| OAuth device flow | `gh auth`, Azure CLI | Auth only — not sign/pay |
| Secure handoff | Grok “take control” / masked secret request | Host-owned; we still prefer our URL for product acts |

## Open-source landscape: is there an “AI SDK for HITL”?

Short answer: **no mature cross-host equivalent to Vercel AI SDK / Chat SDK**
that abstracts Claude Code + ChatGPT + Grok HITL the way AI SDK abstracts model
providers. Closest building blocks:

| Project | Stars (approx) | What it is | Fit for Vortex |
| ------- | -------------- | ---------- | -------------- |
| **MCP + official TypeScript SDK** | high | Wire protocol + `elicitation/create` form & URL | **Primary dependency.** Implement Workflow A as URL elicitation + poll. |
| **elicitkit/elicitkit** | ~1 | Portable typed `Ask` vocabulary + MCP ref + conformance; progressive tiers `apps → url → elicitation → tui` | Study for Workflow B (typed non-sensitive asks). Early; not a substitute for InteractionSession. |
| **LangChain MCP adapters** (`elicitation.ts`) | (via langchainjs) | Bridges MCP elicitation ↔ LangGraph `interrupt` | Pattern reference if we ever host agents in LangGraph; not a host adapter for Claude/ChatGPT. |
| **cafitac/codex-channels** | ~2 | Codex-first local runtime for approvals / elicitation / Slack channels | Codex-specific; example of “interaction runtime,” not portfolio default. |
| **mcp-use/mcp-elicitation-demo** | ~1 | Demo server for form + URL elicitation | Conformance / dogfood client testing. |
| **Vercel AI SDK / ai-chatbot** | very high | Model + tool UX **inside your app** | Great for building *our* oversight chat; does **not** span Claude Code / ChatGPT host boundaries. |
| **Paperclip** | very high | Agent ops app; has elicitation adapters in runner | Ops surface inspiration; not the product HITL contract. |

### Recommendation on SDKs

1. **Do not wait for a Chat-SDK-class HITL library.** The standard is MCP URL
   elicitation + a product `InteractionSession` object.
2. **Implement** `@vortexnyc/interaction` (or Core package name TBD) as thin:
   create / get / wait / map-to-MCP-URL-elicitation. Seal is first producer.
3. **Optionally study elicitkit** for Workflow B question types later — do not
   block Workflow A on it.
4. **Use official `@modelcontextprotocol/*` SDK** in MCP workers; do not
   reimplement elicitation wire framing.

## Consequences

- SEA-61 implementation = Workflow A schema + Seal sign as first conforming
  producer; MCP send/sign tools emit URL elicitation (not form) when a human
  must act.
- Frontend stays moment-of-need pages (one job, one CTA). Oversight UI answers
  only: what are agents doing, what is blocked, what needs me.
- New host integrations are adapters (how to show `url`), not new product
  workflows.

## Open questions (bounded)

1. Core package home: `vortex-core` publish name (`@vortexnyc/interaction`?).
2. Webhook vs poll-only for completion in cloud agents (poll mandatory; webhook
   optional accelerate).
3. Whether ChatGPT Apps widget is ever worth it for sign vs always external URL
   (default: external URL; widget is polish).

## Ticket map

- **SEA-61** — implement Interaction Session primitive (this ADR’s Workflow A).
- Design notes live in this ADR; amend as platforms ship (do not fork a second
  “philosophy” doc).
