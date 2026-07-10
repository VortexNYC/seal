# Seal QA Execution Agent Handoff

## Mission

Own the app-wide Seal QA execution loop.

The setup is already done:

- Canonical tracker: `docs/qa/feature-user-stories.csv`
- Operating loop: `docs/qa/qa-operating-loop.md`
- Tracker audit: `bun run audit:qa-feature-tracker`

Your job is to start testing every user story in the tracker, document every error in the tracker, fix logistical or UX errors in code, and retest the exact same behavior after each fix.

## Current Git Truth

- Repo: `/Users/shlomokabareti/Projects/Seal`
- Branch: `codex/sea-557-provider-neutral-data-contracts`
- Local branch is ahead of origin by 2 commits:
  - `9701f7a5 chore: prepare Seal Vortex production setup`
  - `2238594d chore: add Seal feature QA tracker`
- Do not push without explicit user confirmation.

## Current Proof Truth

Already passing:

- `bun run audit:qa-feature-tracker`
- `bun run format:changed:check`
- `bun run typecheck`
- `bun run prove:seal-vortex-migration-local`

The tracker currently has 86 rows and every story is `not_started`.

## Test Environment

Read `.test-env` first. It is the source of truth.

Important values from the latest setup:

- Web automation tool: `vb`
- Local app URL: `http://seal.localhost:1355`
- Dev command: `cd /Users/shlomokabareti/Projects/Seal && portless seal ol bun run dev:web`
- Use staging for Vortex Connect, subscriptions, billing, and payment verification:
  - `https://staging-app.seal.nyc`
  - Convex deployment: `clever-goose-484`

## Non-Negotiable Rules

- Keep `docs/qa/feature-user-stories.csv` canonical. Do not create competing trackers.
- Every test must update the matching tracker row.
- Every failure needs `test_status=failed`, a concise `error_summary`, and evidence.
- Every fix needs `issue_status=fixed_pending_retest` until the same story is retested.
- Every retest must update `retest_evidence` and end in `retest_passed` or `failed`.
- Run `bun run audit:qa-feature-tracker` after tracker edits.
- Do not reintroduce the retired provider token. `bun run prove:seal-vortex-migration-local` must keep passing.
- Do not run live production money movement, production settlement, payout, or production proof commands unless explicitly instructed by the user.
- Do not push without explicit user confirmation.

## First Execution Slice

Start with low-risk browser stories against local dev:

1. `AUTH-001`
2. `AUTH-002`
3. `ORG-001`
4. `ORG-002`
5. `DASH-001`
6. `CONTACT-001`
7. `CONTACT-002`
8. `CONTACT-003`
9. `CONTACT-004`
10. `CONTACT-005`

Use `vb --fresh` unless you need a persisted session. Capture screenshots/session evidence and check console/backend logs after each action.

## Suggested Loop

1. Start dev server if not already running.
2. Run `bun run audit:qa-feature-tracker`.
3. Pick the next `not_started` row from the first execution slice.
4. Mark it `in_progress`.
5. Execute the user behavior.
6. Update the row:
   - `passed` with evidence, or
   - `failed` with error summary and evidence.
7. Fix real UX/logistical bugs in the smallest safe code change.
8. Retest the same row.
9. Run:
   - `bun run audit:qa-feature-tracker`
   - relevant targeted tests
   - `bun run format:changed:check`
   - `bun run typecheck`
10. Commit completed coherent chunks locally. Do not push.

## Reporting

When reporting back, include:

- Rows tested.
- Rows passed.
- Rows failed.
- Fixes made.
- Retest evidence.
- Commands run.
- Remaining next row.

Do not summarize “looks good” without tracker updates and evidence.
