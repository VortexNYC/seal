# ADR-007: Frontend appears when needed — steal DocuSeal + Documenso juice

## Status

Accepted

## Date

2026-09-25

## Context

Seal is not competing with DocuSign’s product surface. Agents create, send,
remind, void, and poll (ADR-003 / ADR-004 / ADR-005). Humans get a small
surface when a decision or signature is required — then it should get out of
the way.

Local OSS compare (`docs/oss-esign-ui-compare.md`) showed:

- **DocuSeal** owns the chrome budget (invite → START; thin header; PDF hero;
  one field CTA).
- **Documenso** owns the layout shape (PDF + one sticky widget) and the cheap
  local PAdES seal path (`@libpdf/core` + `.p12`).
- **OpenSign** is density we refuse.

Seal’s signer today is denser than all three (Recipient Details, Activity,
triple progress, blank PDF). That is the wrong vision.

## Decision

1. **UI is an appearance, not a workplace.** Product UI shows up for consent,
   signature, decline, and rare unblock. It is not a DocuSign clone, dashboard
   of features, or place to “work documents.” Chrome is Kumo.
2. **Line up with DocuSeal + Documenso in order — do not flat-copy UI:**
   1. **Components** — field types, signing/builder blocks (React + Kumo)
   2. **Typed patterns** — fieldMeta, auth, embed schemas, seal-on-complete
   3. **Pages / workflows** — investigate each surface; keep / adapt / skip
   Checklist: `docs/oss-esign-component-lineup.md`. Compare notes:
   `docs/oss-esign-ui-compare.md`.
3. **Signer end-state (after lineup + page decisions):** title · PDF+fields ·
   one progress · one CTA · Decline · consent once (**SEA-78**). PDF must paint
   first (**SEA-74**).
4. **Platform beyond chrome** stays agent-native: OpenAPI / MCP / SDK /
   InteractionSession. Legal review primitives are Mike-shaped design only
   (ADR-006) — not a second fat UI.

## Consequences

- Feature requests that add signer chrome answer: “does an agent need this, or
  does a human need it *in the moment of signing*?” If neither — refuse.
- CompAI / enterprise trust can exist without shipping DocuSign UX.
- Sender “Activity” lives on oversight routes, never on the guest signer.

## Related

- ADR-002 (Kumo-only product UI)
- ADR-003 / ADR-004 / ADR-005 (agent path + Seal-only signing)
- ADR-006 (Mike legal primitives — design port)
- `docs/oss-esign-ui-compare.md`
