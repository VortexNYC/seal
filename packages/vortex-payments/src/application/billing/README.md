# Billing-facing application surface

This directory is canonical seam between monorepo `payments` and `billing` packages.

This seam is final.

Rules:

- expose workflow-shaped contracts only
- use Vortex nouns only
- no provider adapter types
- no storage/repository types
- no Finix/Payrix state names
- no leaking processor, webhook, or rail execution semantics into billing-facing contracts

If `vortex-billing` needs payment behavior, add it here first.
If billing asks for provider internals directly, contract is wrong.
