# ADR-001: Seal by Vortex brand model

## Status

Accepted

## Date

2026-09-14

## Context

Seal is an open-source, agent-native e-signature product. Vortex is the shared
platform that provides auth, payments, observability, and infrastructure. The
product needs its own consumer-facing identity so it can live on `seal.nyc` and
be presented as a distinct offering, while remaining powered by Vortex under the
hood.

Key questions:

- Should the product keep the "Vortex" name, or get its own name?
- How do we reference the Vortex platform primitives (Auth, Payments, etc.)?
- What visual identity does the product get?

## Decision

The product is **Seal by Vortex**.

- **Consumer-facing name and domain:** Seal (`seal.nyc`)
- **Platform attribution:** "by Vortex" — the landing, README, and product copy
  make clear that Seal is powered by Vortex
- **Platform primitives retain the Vortex name:** Vortex Auth, Vortex Payments,
  Vortex Observability, etc.
- **Product logo:** a distinct mark from Vortex's own logo. A feather or quill
  is the proposed direction, symbolizing documents and signature.

## Consequences

- `README.md`, OpenAPI metadata, and AGENTS docs refer to the product as
  "Seal by Vortex"
- The landing and product UI use "Seal" as the primary brand, with "by Vortex"
  as secondary attribution where appropriate
- Vortex Auth / Vortex Payments / Vortex Connect surfaces keep their Vortex
  names because they are shared platform services
- A new Seal logo/mark is required and should be visually separate from the
  Vortex brand mark
- Future Vortex-powered consumer products can follow the same
  `{Product} by Vortex` pattern
