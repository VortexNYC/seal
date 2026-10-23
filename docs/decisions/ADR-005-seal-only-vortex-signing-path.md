# ADR-005: Seal is the only Vortex signing path

## Status

Accepted

## Date

2026-09-25

## Context

DocuSign’s moat is **default + switching cost**. SEA-59 is the same move inside
Vortex: Seal must be the only allowed path for day-to-day company signing
(offers, NDAs, vendor packets, contractor agreements, corporate filings that
are not court/government portals).

Eng already unblocked the agent path (OpenAPI / MCP / CLI / InteractionSession
URL+poll — ADR-003, ADR-004). Ops owns canceling leftover DocuSign seats. This
ADR is the durable rule agents and humans follow so exceptions do not grow back.

Import adapters that *read* historical DocuSign/PandaDoc envelopes may remain
as one-way migration tools. They are not a create/send path.

## Decision

1. **No new DocuSign, PandaDoc, HelloSign, or Adobe Sign** for Vortex company
   documents. Agents must refuse to set those up or draft “send via DocuSign”
   flows.
2. **Create, send, remind, void, wait, and audit through Seal** — API, MCP,
   CLI (`seal`), or the Seal web oversight UI. Human handoff is
   InteractionSession (ADR-004): open `signing_url` → human signs → poll.
3. **Graded signer auth** (access code / email OTP) when the signing URL may
   transit an agent context (SEA-48).
4. **Gaps become SEA tickets**, not vendor exceptions. If Seal cannot do it
   yet, file the gap and wait — do not reopen DocuSign for convenience.
5. **Done signal for SEA-59 (ops):** zero active DocuSign seats used for
   day-to-day Vortex signing. Eng’s part of done is this rule plus a working
   agent golden path (`pnpm run prove:golden-path`).

## Consequences

- Portfolio AGENTS / Hermes treat “sign this” as Seal by default.
- Corporate filing checklists and contractor packets name Seal, not DocuSign.
- Competitive copy may still *mention* DocuSign; product workflows must not
  *use* it.

## Related

- SEA-59 (portfolio default)
- ADR-003 (agents do not sign)
- ADR-004 (InteractionSession)
- `apps/docs/docs/getting-started/agents.mdx`
