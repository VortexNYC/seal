# ADR-003: Agent-native OpenAPI contract and who may sign

## Status

Accepted

## Date

2026-09-24

## Context

Seal is used primarily from agent environments (Claude, Codex, CLI, MCP), not
as a human-operated SPA. The web app remains for oversight, decisions, and
trust — not as the work surface.

We need a durable rule for:

1. What is the product contract for agents?
2. How MCP / CLI / SDK relate to that contract?
3. Which channels carry deals (email, later messaging)?
4. Whether AI agents may apply the legal signature themselves?

Payments / Vortex Connect are intentionally deferred until Vortex is ready;
this ADR still states how agents relate to signing so we do not invent an
illegal or competition-misaligned path.

## Decision

### 1. OpenAPI is the contract

`apps/docs/openapi.yaml` (rendered at docs.seal.nyc `/reference`) is the
**source of truth** for every “do or fetch” capability agents need.

- If a human can perform an operational action in the product, it belongs on
  OpenAPI (or it is not product — delete / do not grow session-only debt).
- Session-cookie SPA routes are an implementation detail for the oversight UI,
  not a parallel agent API.

### 2. MCP, CLI, and SDK follow OpenAPI

| Surface | Role |
| ------- | ---- |
| OpenAPI / HTTP API | Contract |
| MCP | Typed tools + prompts over the same API |
| CLI (`seal`) | Thin client over the same API (verbs may grow; must not invent endpoints) |
| SDK | Typed client / embed over the same API |

Do not ship MCP-only or CLI-only behavior. Spec first, then wrap.

### 3. Agents operate; humans decide and sign intent

- **Agents** prepare documents, place fields, add recipients, send, remind,
  void, poll status, consume webhooks, pull audit, and orchestrate email
  (and later messaging).
- **Humans** make trust decisions and perform the **act of signing**
  (intent + identity).
- The SPA is a monitoring / unblock surface, not the primary operator path.

### 4. Agents do not apply the legal signature

**Agents must not be modeled as the signatory.**

- Signature application stays on the recipient path: public `/sign/$token`,
  embed SDK, or equivalent human-facing flow with audit that attributes a
  natural person (or, later, an org **electronic seal** — not “the LLM signed”).
- This matches market practice (agent-native e-sign products: agents prepare /
  route / track; humans review and sign) and EU eIDAS (electronic signatures
  are created by natural persons; org automation is a seal, not a signature).
- US ESIGN/UETA allow electronic *agents* to help form contracts when acts are
  attributable to a person/company — that is attribution, not “the model is
  the signer of record.”

**Out of scope unless a future ADR + counsel review:** “sign on behalf of an
authenticated human” with explicit prior consent. That would still name the
**human** in the audit trail, never the model.

### 5. Email is a first-class channel

Most deals flow through email (Cloudflare Email Sending / Routing). Agents +
email must be able to run the sender-side process end-to-end. Messaging
channels are expected later under the same OpenAPI-first rule.

### 6. Payments

Do not invent Seal-local payment agent flows until Vortex payments / Connect
are ready. When they land, they still enter through OpenAPI first.

## Consequences

- Review rejects PRs that add operational capability only to the SPA or
  session APIs without OpenAPI.
- MCP tool/docs drift is a bug; tool count and OpenAPI must stay aligned.
- No MCP/API endpoint that applies a signature as an AI agent identity.
- Docs (`getting-started/agents`, MCP `seal://docs/agent-roles`) state this
  for humans and agents.
- Smoke / golden path: agent sender side + human (or public token) signer side.

## References

- Competition pattern: agent prepares/routes; human signs (e.g. Sign.com
  agent e-sign positioning).
- eIDAS: signatory is a natural person; legal-person automation → electronic seal.
- ESIGN / UETA: electronic agents and attribution to a person/entity.
