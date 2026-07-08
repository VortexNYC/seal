# Seal App-Wide QA Operating Loop

## Objective

Create one canonical tracker for every user-visible feature in Seal, derive user stories and expected behavior from the code, test every story, document every error, fix logistical and UX errors, then retest the same behaviors.

## Canonical Tracker

Source of truth:

- `docs/qa/feature-user-stories.csv`

This CSV is the spreadsheet. If a Google Sheets connector is available later, mirror this file there, but do not let a remote sheet become the only source of truth.

## Columns

- `feature_id`: Stable id, grouped by product area.
- `area`: Product surface or domain.
- `feature`: Human-readable feature name.
- `primary_user`: User role for the story.
- `story`: User story written from the user's perspective.
- `expected_behavior`: Expected behavior derived from routes, components, backend functions, and tests.
- `entry_points`: Routes, dialogs, API endpoints, webhooks, or emails used to reach the feature.
- `code_refs`: Primary code files that define the behavior.
- `existing_coverage`: Tests, proof scripts, or audits that already cover part of the story.
- `test_type`: `unit`, `integration`, `browser`, `api`, `email`, `proof`, or `manual-live`.
- `test_status`: `not_started`, `blocked`, `in_progress`, `passed`, `failed`, or `retest_passed`.
- `last_tested_at`: ISO timestamp or blank.
- `tester`: Agent/thread/person responsible for the last test.
- `issue_status`: `none`, `bug_logged`, `fix_in_progress`, `fixed_pending_retest`, or `closed`.
- `error_summary`: Concise failure summary.
- `evidence`: Test command, session JSON, screenshot path, Linear issue, or proof artifact.
- `fix_refs`: Commit/file references for fixes.
- `retest_evidence`: Evidence from post-fix retest.
- `production_notes`: Live/prod caveats, credentials, settlement, external-provider, or rollout notes.

## Manager Loop

1. Inventory features top-down from routes, navigation, backend modules, tests, emails, API endpoints, and proof scripts.
2. Normalize each feature into one or more user stories with observable expected behavior.
3. Assign test type and tester.
4. Run tests or delegate bounded test passes.
5. Record every failure in the tracker with evidence.
6. Fix logistical and UX errors in code.
7. Retest the exact failed story and record `retest_evidence`.
8. Stop only when every row is `passed`, `retest_passed`, or explicitly `blocked` by a real external constraint.

## Agent Split

The control thread owns scope, tracker schema, merge decisions, and final proof. `gpt-5.4-mini` agents can own bounded inventory or testing slices:

- Auth, onboarding, team, settings.
- Documents, signing, recipients, templates, folders.
- Contacts, dashboard, notifications, AI, analytics.
- Payments, billing, merchant operations, Vortex proof surfaces.
- Landing, developer docs, API, transactional emails.

Mini agents must return tracker-ready CSV rows or test evidence. They should not change code unless explicitly assigned a disjoint fix scope.

## Testing Rules

- Browser tests should use the project test environment and the app's existing browser automation wrappers when available.
- Every UI test must record the route, action sequence, expected result, actual result, screenshot/session evidence, and console/backend errors.
- Live money, settlement, payout, and production proof work is tracked separately as `manual-live` or `proof` with explicit evidence.
- A row is not done because a related unit test exists. A row is done when its user story has direct evidence or an explicit block.
