---
name: test-assessment
description: Run all test suites and produce a structured assessment report. Use when asked to check tests, run all tests, assess test health, or audit test results across the monorepo. This skill reports results only — it never fixes failures.
---

# Test Assessment

Run every available test suite across the monorepo, collect results, and produce a structured pass/fail assessment. This skill is strictly read-only — it reports what it finds and never attempts fixes.

## Workflow

### 1. Inventory test suites

Confirm which suites exist by checking for the expected files and configs:

| Suite          | Type               | Location                              | Command                               |
| -------------- | ------------------ | ------------------------------------- | ------------------------------------- |
| Backend Vitest | Unit + Integration | `apps/backend/convex/**/*.test.ts`    | `cd apps/backend && bun run test`     |
| Web Vitest     | Unit               | `apps/web/src/**/*.test.{ts,tsx}`     | `cd apps/web && bun run test`         |
| MCP Server     | Unit               | `apps/mcp-server/src/**/*.test.ts`    | `cd apps/mcp-server && bun run test`  |
| Web E2E        | E2E                | `apps/web/e2e/tests/**/*.spec.ts`     | `cd apps/web && bun run test:e2e`     |
| Landing E2E    | E2E                | `apps/landing/e2e/tests/**/*.spec.ts` | `cd apps/landing && bun run test:e2e` |

If a location has zero matching test files, report that suite as `NO TESTS FOUND`.

### 2. Check prerequisites before running

**Backend Vitest** — Always runnable. No special prerequisites.

**Web Vitest** — Always runnable. No special prerequisites.

**MCP Server** — Always runnable. No special prerequisites.

**Web E2E (Playwright)** — Check all of the following before attempting to run:

1. Auth testing env vars are set (check `apps/web/.env.test` or environment for the auth provider's publishable key)
2. `VITE_CONVEX_URL` is set or the default `http://localhost:5180` is reachable (try `curl -s -o /dev/null -w "%{http_code}" http://localhost:5180`)
3. Playwright browsers are installed (check `node_modules/.cache/ms-playwright` or `apps/web/node_modules/.cache/ms-playwright`)

If any prerequisite is missing, mark E2E as `SKIPPED (prerequisites not met)` and list exactly which prerequisites failed. Do not attempt to install browsers or start servers.

**Landing E2E (Playwright)** — Check the following:

1. Playwright browsers are installed
2. The landing dev server or build is available

If prerequisites are missing, mark as `SKIPPED (prerequisites not met)`.

### 3. Execute runnable suites

Run each locally-runnable suite sequentially. Capture exit codes and full output. Use a timeout of 5 minutes per suite (300000ms) to avoid hanging.

**Execution order** (fastest first):

1. MCP Server (`cd apps/mcp-server && bun run test`)
2. Web Vitest (`cd apps/web && bun run test`)
3. Backend Vitest (`cd apps/backend && bun run test`)
4. Web E2E Playwright (only if prerequisites passed in step 2)
5. Landing E2E Playwright (only if prerequisites passed in step 2)

If the user passes an argument like `--unit-only`, `--e2e-only`, `--backend-only`, `--web-only`, or `--mcp-only`, restrict execution to the requested subset and mark other suites as `NOT REQUESTED`.

### 4. Collect results

For each suite, extract from the output:

- Total test count
- Passed count
- Failed count
- Skipped count
- Duration
- If failures exist: the names and short error messages of the first 10 failing tests

### 5. Produce the assessment report

Assemble the final report using the output template below.

## Rules

- Never fix, modify, or suggest fixes for failing tests
- Never install dependencies, start dev servers, or change configuration
- Never create or modify any project files
- If a suite fails to run for an unexpected reason (not a prerequisite issue), report it as `ERROR` with the raw error message
- Always run backend tests even if they are slow — they are the primary test suite
- If the user asks to run only a subset, honor that and mark other suites as `NOT REQUESTED`
- Clearly label every suite with its test type (Unit, Integration, E2E)

## Output

Use this summary shape:

```text
Test Assessment Report
======================

## MCP Server Unit (bun test)
- Location: apps/mcp-server/src/**/*.test.ts
- Status: PASS / FAIL / ERROR / SKIPPED / NO TESTS FOUND
- Tests: X passed, Y failed, Z skipped (total: N)
- Duration: Xs

## Web Unit (Vitest)
- Location: apps/web/src/**/*.test.{ts,tsx}
- Status: PASS / FAIL / ERROR / SKIPPED / NO TESTS FOUND
- Tests: X passed, Y failed, Z skipped (total: N)
- Duration: Xs

## Backend Unit + Integration (Vitest + convex-test)
- Location: apps/backend/convex/**/*.test.ts
- Status: PASS / FAIL / ERROR / SKIPPED / NO TESTS FOUND
- Tests: X passed, Y failed, Z skipped (total: N)
- Duration: Xs

## Web E2E (Playwright)
- Location: apps/web/e2e/tests/**/*.spec.ts
- Status: PASS / FAIL / SKIPPED (prerequisites not met) / ERROR / NO TESTS FOUND
- Prerequisite check:
  - Auth env vars: SET / MISSING
  - Dev server (localhost:5180): REACHABLE / UNREACHABLE
  - Playwright browsers: INSTALLED / MISSING
- Tests: X passed, Y failed, Z skipped (total: N)
- Duration: Xs

## Landing E2E (Playwright)
- Location: apps/landing/e2e/tests/**/*.spec.ts
- Status: PASS / FAIL / SKIPPED (prerequisites not met) / ERROR / NO TESTS FOUND
- Prerequisite check:
  - Playwright browsers: INSTALLED / MISSING
- Tests: X passed, Y failed, Z skipped (total: N)
- Duration: Xs

---
Overall: X suites passed, Y failed, Z skipped, W errors
Total tests: X passed, Y failed, Z skipped
```

If any suite has failures, append a **Failures Detail** section:

```text
## Failures Detail

### Backend (Y failures)
1. `test name here` — Error: truncated message...
2. `test name here` — Error: truncated message...

### Web E2E (Y failures)
1. `test name here` — Error: truncated message...
```

Truncate each error excerpt to 200 characters. Show at most 10 failures per suite.
