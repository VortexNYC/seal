---
name: fix-verify
description: "Fix failures from `bun run verify`, including lint, format, typecheck, and dead-code issues. Use when the user asks to fix static analysis, type errors, lint failures, or knip issues in this repository."
---

Identify and resolve issues reported by `bun run verify`.

## Scope

Treat this as a remediation workflow for the repository-wide verification suite:

- Oxlint
- Oxfmt
- TypeScript type checking
- Knip

Run commands from the project root.

## Process

1. Run `bun run verify`.
2. Categorize issues by type and file.
3. Prioritize type errors and syntax errors before style issues.
4. Apply automatic fixes where appropriate:
   - `bun run lint:fix`
   - `bun run oxfmt:fix`
   - `bun run knip:fix`
5. Fix remaining issues manually with targeted code changes.
6. Re-run `bun run verify`.
7. Report any remaining issues that require manual intervention.

## Rules

- Never suppress errors with `@ts-ignore`, `@ts-expect-error`, or `as any`.
- Fix root causes rather than hiding symptoms.
- Preserve intended behavior while fixing analysis issues.
- Follow repository conventions from `AGENTS.md` and the surrounding code.

## Common fix patterns

- remove unused imports
- remove unused variables and unreachable code
- add proper types and annotations
- update imports after refactors
- fix formatting and import ordering

## Final response

Report:

- initial issue categories
- what was auto-fixed
- what was fixed manually
- whether `bun run verify` passes cleanly
- any remaining blockers
