# Landing E2E Tests

Playwright smoke coverage for the public `apps/landing` site.

## Commands

```bash
bun run test:e2e
bun run test:e2e:ui
bun run test:e2e:headed
bun run test:e2e:debug
bun run test:e2e:report
```

## Scope

- Homepage rendering and critical sections
- Desktop and mobile navigation
- Primary CTA href validation
- Representative public routes: integrations, changelog, docs, API reference, privacy, terms

The suite is intentionally smoke-focused rather than a full docs crawl.
