#!/usr/bin/env bash
# Run Playwright E2E on the Mac Mini. Browsers stay off your laptop, results come back here.
#
# Usage:
#   scripts/e2e-mini.sh                       # full chromium suite
#   scripts/e2e-mini.sh smoke-contract        # smoke chain only
#   scripts/e2e-mini.sh chromium auth.e2e.ts  # specific test, chromium project
#   SYNC=1 scripts/e2e-mini.sh                # rsync working tree first (uncommitted changes)
#
# Defaults: project=chromium, app=apps/web, host=mini (~/projects/vortex-sign)

set -euo pipefail

HOST="${MINI_HOST:-mini}"
REMOTE_PATH="${MINI_PATH:-projects/vortex-sign}"
APP="${APP:-apps/web}"
PROJECT="${1:-chromium}"
shift || true
EXTRA_ARGS=("$@")

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ "${SYNC:-0}" == "1" ]]; then
  echo "[e2e-mini] rsync working tree → $HOST:$REMOTE_PATH"
  rsync -az --delete \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=test-results \
    --exclude=playwright-report \
    --exclude=playwright/.auth \
    --exclude=.turbo \
    --exclude=.cache \
    --exclude=dist \
    --exclude=.env.local \
    "$REPO_ROOT/" "$HOST:$REMOTE_PATH/"
else
  echo "[e2e-mini] skipping sync — using whatever state exists on Mini (use SYNC=1 to push)"
fi

FULL_PARALLEL="${FULL_PARALLEL:-0}"
# CI=1 = 2 workers + 2 retries (matches CI, stable). Set FULL_PARALLEL=1 for cores/2 workers (faster, flakier).
ENV_PREFIX="set -a; source .env.test; set +a;"
WORKER_FLAGS="CI=1"
[[ "$FULL_PARALLEL" == "1" ]] && WORKER_FLAGS=""

REMOTE_CMD="cd $REMOTE_PATH/$APP && export PATH=\"\$HOME/.bun/bin:\$PATH\" && pkill -f 'vite|playwright|chromium_headless' 2>/dev/null; sleep 1; $ENV_PREFIX $WORKER_FLAGS pnpm exec playwright test --project=$PROJECT --reporter=list ${EXTRA_ARGS[*]:-}"

echo "[e2e-mini] running on $HOST: project=$PROJECT ${EXTRA_ARGS[*]:-}"
echo "[e2e-mini] cmd: $REMOTE_CMD"
echo

# Stream output as it happens
ssh "$HOST" "$REMOTE_CMD"
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo
  echo "[e2e-mini] suite failed — pulling test-results/ back"
  mkdir -p "$REPO_ROOT/$APP/test-results"
  rsync -az "$HOST:$REMOTE_PATH/$APP/test-results/" "$REPO_ROOT/$APP/test-results/" || true
  rsync -az "$HOST:$REMOTE_PATH/$APP/playwright-report/" "$REPO_ROOT/$APP/playwright-report/" 2>/dev/null || true
  echo "[e2e-mini] artifacts in $APP/test-results and $APP/playwright-report"
  echo "[e2e-mini] view html report: cd $APP && pnpm exec playwright show-report"
fi

exit $EXIT_CODE
