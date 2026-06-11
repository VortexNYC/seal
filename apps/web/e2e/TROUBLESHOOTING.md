# E2E Troubleshooting Playbook

This playbook covers common Playwright test failures, flaky-test triage patterns, and local reproduction steps for the Seal web app E2E suite. It assumes you have read [apps/web/e2e/README.md](./README.md) for setup basics.

## Quick Diagnostic Checklist

Before digging into a specific failure, run through these:

1. **Are your env vars correct?** Check `.env.test` against `.env.test.example`. The preflight in `fixtures/preflight.ts` validates `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, `VITE_CONVEX_URL`, and `CONVEX_DEPLOY_KEY` at the start of each setup phase.
2. **Is the dev server running on port 5180?** Playwright auto-starts it for you (`playwright.config.ts:155`), but a stale process on that port will cause `ERR_CONNECTION_REFUSED`.
3. **Are Playwright browsers installed?** Run `bun --cwd apps/web x playwright install chromium` if you see `Executable doesn't exist` errors.
4. **Is the cached auth state stale?** Delete `apps/web/playwright/.auth/` and re-run.

## Common Failure Categories

### 1. Authentication Failures

**Symptoms:** Tests fail at the sign-in step, `setup-auth` project hangs, Better-Auth cookie not present, or `ensureAuthenticatedWorkspaceHome` times out.

**Root causes and fixes:**

| Cause                               | Fix                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.test` has wrong credentials   | Verify `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` point to a real test user. If the user doesn't exist, the sign-up path in `auth-helpers.ts` will create it.                                       |
| Stale Better-Auth session cookie    | Delete `apps/web/playwright/.auth/` (contains `user.json`, `workspace-slug.txt`, `e2e-pdf-storage-id.txt`). This forces a fresh sign-in on the next run.                                                    |
| Sign-in form selectors broke        | The auth helpers use `input[type="email"]`, `input[type="password"]`, and `button[type="submit"]` selectors (`fixtures/auth-helpers.ts:65-67`). If the sign-in page markup changed, update those selectors. |
| Convex auth not ready after sign-in | `ensureConvexAuth` polls until Convex reports the user is authenticated. If this times out, the Convex deployment may be slow or unreachable. Check `VITE_CONVEX_URL`.                                      |
| Onboarding redirect loop            | `completeOnboardingIfPresent` (`auth-helpers.ts:56`) handles the first-time sign-up onboarding flow. If the onboarding form or redirect URL changed, update the helper.                                     |

**Local repro:**

```bash
rm -rf apps/web/playwright/.auth/
bun --cwd apps/web run test:e2e -- tests/auth.e2e.ts
```

### 2. Smoke Contract Failures

**Symptoms:** Tests in `smoke-contract.e2e.ts` fail with "setup artifacts exist" or "convex test helpers are unreachable". This blocks all downstream browser suites (chromium, firefox, webkit, mobile).

**Root causes and fixes:**

| Cause                                             | Fix                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing `playwright/.auth/user.json`              | `setup-auth` did not complete. Re-run; check auth failure section above.                                                                            |
| Missing `playwright/.auth/workspace-slug.txt`     | `setup-app` did not complete after auth. The workspace slug resolution in `fixtures/workspace-state.ts` may have failed.                            |
| Missing `playwright/.auth/e2e-pdf-storage-id.txt` | `setup-backend` failed to upload the sample PDF to Convex storage. Check that `CONVEX_DEPLOY_KEY` is set and that the Convex deployment is healthy. |
| `assertConvexE2eHelperAvailability` fails         | The seeded Convex HTTP actions (in `backend.setup.ts`) are not reachable. Verify `VITE_CONVEX_URL` and network access.                              |

**Local repro:**

```bash
rm -rf apps/web/playwright/.auth/
bun --cwd apps/web run test:e2e -- tests/smoke-contract.e2e.ts
```

### 3. Timing / Flaky Tests

**Symptoms:** Tests pass locally but fail in CI, or pass on retry. Common patterns: "element not visible", "timeout waiting for URL", or toasts not appearing.

**Understanding the time budget:**

- **Test timeout:** 20s total per test (`playwright.config.ts:165`)
- **Navigation timeout:** 10s per `page.goto()` (`playwright.config.ts:52`)
- **Action timeout:** 5s per click/fill (`playwright.config.ts:55`)
- **Expect timeout:** 5s per assertion (`playwright.config.ts:168`)
- **CI retries:** 2 (`playwright.config.ts:26`)

If a test consistently passes on retry in CI, the most likely cause is a race condition.

**Common flake patterns and fixes:**

| Pattern                                                | Fix                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Test asserts before Convex real-time update propagates | Use `waitForConvexMutation()` from `fixtures/convex-helpers.ts` after any mutation. Or add `await page.waitForTimeout(500)` for UI re-render after mutation completes.                                                               |
| Toast notification (Sonner) not yet rendered           | Use `waitForToast(page, "message")` from `utils/test-helpers.ts`. Sonner toasts sit in `[data-sonner-toast]` elements.                                                                                                               |
| Page navigated away before assertion                   | Ensure `waitForURL()` or `waitForLoadState("domcontentloaded")` completes before asserting page content.                                                                                                                             |
| Convex WebSocket reconnection mid-test                 | If the Convex WebSocket drops, queries go stale. Check `window.convex?.connectionState` in DevTools. Restart the dev server or wait for reconnect.                                                                                   |
| Test isolation leak (shared state between tests)       | Tests are `fullyParallel: true` (`playwright.config.ts:22`). Each test must create its own data. The `createApiDocument` fixture auto-deletes documents after each test. If you added new stateful operations, ensure they clean up. |
| Stale `data-testid` selectors                          | Run `PWDEBUG=1 bun --cwd apps/web run test:e2e` and inspect the DOM at the point of failure. Update selectors if the component markup changed.                                                                                       |

**Local repro for flaky tests:**

```bash
# Run a single flaky test 5 times to reproduce
for i in $(seq 1 5); do
  echo "Run $i"
  bun --cwd apps/web run test:e2e -- tests/documents.e2e.ts --repeat-each=3
done
```

### 4. Setup Phase Failures

**Symptoms:** `setup-auth`, `setup-app`, or `setup-backend` project fails. Log output shows `[E2E preflight]` errors.

**Understanding the setup pipeline:**

```
setup-auth → setup-app → setup-backend → smoke-contract → {chromium, firefox, webkit, mobile}
```

Each dependency must complete before the next phase starts (`playwright.config.ts:66,76,82,92`).

**Setup-specific debugging:**

| Phase           | File                     | What it does                                                                   | Common failure                                                            |
| --------------- | ------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `setup-auth`    | `tests/auth.setup.ts`    | Signs in test user via Better-Auth, saves `user.json`                          | Wrong credentials, auth form selector change, Convex auth polling timeout |
| `setup-app`     | `tests/app.setup.ts`     | Resolves workspace slug from authenticated session, saves `workspace-slug.txt` | Onboarding not completed, workspace slug extraction fails                 |
| `setup-backend` | `tests/backend.setup.ts` | Seeds test data (sample PDF to Convex storage), saves `e2e-pdf-storage-id.txt` | `CONVEX_DEPLOY_KEY` missing, Convex HTTP action unavailable               |

**Local repro for setup failures:**

```bash
rm -rf apps/web/playwright/.auth/
bun --cwd apps/web run test:e2e -- --project=setup-auth
bun --cwd apps/web run test:e2e -- --project=setup-app
bun --cwd apps/web run test:e2e -- --project=setup-backend
```

### 5. Cross-Browser Failures

**Symptoms:** Tests pass in Chromium but fail in Firefox, WebKit, Mobile Chrome, or Mobile Safari.

**Browser-specific issues to check:**

| Browser                   | Common issues                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firefox                   | Stricter cookie policies; Better-Auth session cookie may not persist across navigations with `storageState`. Verify `storageState` includes cookies.              |
| WebKit (Safari)           | Slower JS engine, stricter CSP handling, different `:hover` / `:focus-visible` behavior. Increase timeouts for WebKit-specific runs.                              |
| Mobile Chrome (Pixel 5)   | Viewport-relative selectors may not match. Check responsive layout at 393x851 viewport. Use `getByRole()` and `getByTestId()` instead of position-based locators. |
| Mobile Safari (iPhone 12) | Same as WebKit plus touch-specific event handling. `click()` may not trigger `:active` states the same way.                                                       |

**Local repro for cross-browser:**

```bash
bun --cwd apps/web run test:e2e -- --project=firefox tests/documents.e2e.ts
bun --cwd apps/web run test:e2e -- --project=webkit tests/documents.e2e.ts
```

### 6. CI-Specific Failures

**Symptoms:** Tests pass locally, fail only on CI (GitHub Actions).

**CI differences to account for:**

| Difference                                                      | Impact                                                                                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retries: 2` on CI (`playwright.config.ts:26`)                  | Flaky tests that occasionally pass on retry will show as green. Look at `playwright-report/results.json` to see individual retry results.                                              |
| `workers: 2` on CI (`playwright.config.ts:29`)                  | Two files run in parallel. If tests share mutable backend state (same org), they race. The test org is shared across all workers — mutations that affect org-level state may conflict. |
| `reuseExistingServer: false` on CI (`playwright.config.ts:158`) | Dev server starts fresh each run. Cold boot can take up to 120s. If the server doesn't start in time, tests fail with connection refused.                                              |
| `forbidOnly: true` on CI (`playwright.config.ts:24`)            | Any `test.only()` in the codebase fails the run immediately. Check for leftover `.only()` calls.                                                                                       |
| CI env vars differ from local `.env.test`                       | `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, and `VITE_CONVEX_URL` are set as GitHub secrets, not from `.env.test`. If they differ, auth or backend setup may fail.                |

**Inspecting CI failures locally:**

```bash
CI=true bun --cwd apps/web run test:e2e
```

## Reading Playwright Reports

After a test run, reports are generated in `apps/web/playwright-report/`:

```bash
# Open the HTML report
bun --cwd apps/web run test:e2e:report

# Inspect the JSON results for retry patterns
cat apps/web/playwright-report/results.json | bun -e "const data = require('fs').readFileSync('/dev/stdin','utf8'); JSON.parse(data).suites.forEach(s => s.specs?.forEach(sp => sp.tests?.forEach(t => { if(t.results?.length > 1) console.log('RETRIED:', t.title, '→', t.results.length, 'attempts', '→', t.ok ? 'PASS' : 'FAIL') })))"
```

## Debugging Interactively

```bash
PWDEBUG=1 bun --cwd apps/web run test:e2e -- tests/auth.e2e.ts
```

This opens the Playwright Inspector, allowing you to step through each action and inspect the DOM at every step.

For the full DevTools debugging workflow (console inspection, network analysis, performance tracing), see [DEBUG_WORKFLOWS.md](./DEBUG_WORKFLOWS.md).

## When a Test Is Consistently Flaky

If a test fails roughly 30%+ of the time on CI retries, follow this triage flow:

1. **Isolate the test:** Run it alone 10 times locally.

   ```bash
   for i in $(seq 1 10); do echo "Run $i"; bun --cwd apps/web run test:e2e -- tests/NAME.e2e.ts || break; done
   ```

2. **Check for missing waits:** Does the test wait for Convex mutations? Add `waitForConvexMutation()` after any action that triggers a backend write.

3. **Check for selector fragility:** Replace CSS selectors with `getByTestId()`, `getByRole()`, or `getByLabel()`.

4. **Check for order dependency:** Does the test rely on data created by another test? The `createApiDocument` fixture creates fresh data per test. Do not rely on seeded data unless it was created in the same `test.describe` block.

5. **Check for test isolation:** Does the test mutate shared org-level state (team members, billing, org settings)? If so, it may race with parallel workers. Consider using `test.describe.serial()` for tests that need sequential execution within the same scope.

6. **Increase retries as a last resort:** If the test is fundamentally timing-dependent, increase the retry count for that specific test:
   ```typescript
   test.describe("My flaky feature", () => {
     test.describe.configure({ retries: 2 });
     // ...
   });
   ```

## Quick Reference

| Problem                   | Command                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| Reset auth state          | `rm -rf apps/web/playwright/.auth/`                              |
| Run a single test file    | `bun --cwd apps/web run test:e2e -- tests/auth.e2e.ts`           |
| Run a single test by name | `bun --cwd apps/web run test:e2e -- -g "should login"`           |
| Debug mode                | `PWDEBUG=1 bun --cwd apps/web run test:e2e -- tests/auth.e2e.ts` |
| UI mode                   | `bun --cwd apps/web run test:e2e:ui`                             |
| Headed mode               | `bun --cwd apps/web run test:e2e:headed`                         |
| CI simulation             | `CI=true bun --cwd apps/web run test:e2e`                        |
| View last report          | `bun --cwd apps/web run test:e2e:report`                         |
| List Playwright browsers  | `bun --cwd apps/web x playwright install --list`                 |
| Reinstall browsers        | `bun --cwd apps/web x playwright install --with-deps chromium`   |
