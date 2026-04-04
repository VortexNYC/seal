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
2. If `bun run verify` stops early or hides later failures, run the underlying stages individually so the full queue is visible:
   - `bun run format:check`
   - `bun run lint`
   - `bun run typecheck`
   - `bun run knip`
3. Categorize issues by stage, type, and file.
4. Prioritize syntax errors and type errors before style issues.
5. Apply automatic fixes where appropriate:
   - `bun run lint:fix`
   - `bun run format`
   - `bun run knip:fix`
6. Fix remaining issues manually with targeted code changes.
7. Re-run the affected stage commands until they pass cleanly.
8. Re-run `bun run verify`.
9. Report any remaining issues that require manual intervention.

## Rules

- Never suppress errors with `@ts-ignore`, `@ts-expect-error`, or `as any`.
- Fix root causes rather than hiding symptoms.
- Preserve intended behavior while fixing analysis issues.
- Follow repository conventions from `AGENTS.md` and the surrounding code.
- Use the actual root scripts from `package.json`; do not invent convenience commands that are not defined in this repo.
- If a fix touches Convex source that regenerates `apps/backend/convex/_generated/`, review and include the generated output when appropriate.
- Do not hand-edit generated route trees or generated landing artifacts just to satisfy verification; regenerate them from source instead.

## Common fix patterns

- remove unused imports
- remove unused variables and unreachable code
- add proper types and annotations
- update imports after refactors
- fix formatting and import ordering

## Final response

Report:

- initial issue categories
- whether you had to split `verify` into individual stages
- what was auto-fixed
- what was fixed manually
- whether `bun run verify` passes cleanly
- any remaining blockers
