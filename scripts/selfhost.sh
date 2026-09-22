#!/usr/bin/env bash
# One-command self-host for Seal on Cloudflare Workers.
# No "Deploy to Cloudflare" button theater — this is the path.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }

need pnpm
need wrangler

echo "==> Cloudflare auth"
who="$(pnpm exec wrangler whoami 2>&1)" || die "run: pnpm exec wrangler login"
echo "$who" | head -20

API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
API_TOML="$API_DIR/wrangler.toml"

echo
echo "==> Sanity: do not deploy Vortex production resource IDs by accident"
if grep -qE 'database_id = "87e149a4|bucket_name = "seal-dev-documents|name = "seal-api"' "$API_TOML" 2>/dev/null; then
  echo "WARNING: apps/api/wrangler.toml still looks like Vortex/dev defaults."
  echo "         Create your own D1 + R2, rewrite database_id / bucket_name / worker"
  echo "         names under [env.production], then re-run. See CONTRIBUTING.md."
  if [[ "${SEAL_SELFHOST_FORCE:-}" != "1" ]]; then
    die "refusing to deploy with shared/dev IDs (set SEAL_SELFHOST_FORCE=1 to override)"
  fi
fi

SUFFIX="${SEAL_RESOURCE_SUFFIX:-$(whoami | tr -cd 'a-z0-9' | cut -c1-12)}"
D1_NAME="${SEAL_D1_NAME:-seal-documents-$SUFFIX}"
R2_NAME="${SEAL_R2_NAME:-seal-documents-$SUFFIX}"

echo
echo "==> Provision D1 ($D1_NAME) and R2 ($R2_NAME) if missing"
if ! pnpm --dir "$API_DIR" exec wrangler d1 list 2>/dev/null | grep -q "$D1_NAME"; then
  pnpm --dir "$API_DIR" exec wrangler d1 create "$D1_NAME"
  echo "Paste the new database_id into apps/api/wrangler.toml [env.production], then re-run."
  exit 1
fi
if ! pnpm --dir "$API_DIR" exec wrangler r2 bucket list 2>/dev/null | grep -q "$R2_NAME"; then
  pnpm --dir "$API_DIR" exec wrangler r2 bucket create "$R2_NAME" || true
fi

echo
echo "==> Required secrets on apps/api (production)"
echo "    BETTER_AUTH_SECRET, TOKEN_HASH_SECRET, INTERNAL_API_KEY (>=32 chars)"
echo "    Optional: MCP_SIGNING_KEY"
if [[ "${SEAL_SELFHOST_SKIP_SECRETS:-}" != "1" ]]; then
  for secret in BETTER_AUTH_SECRET TOKEN_HASH_SECRET INTERNAL_API_KEY; do
    if ! pnpm --dir "$API_DIR" exec wrangler secret list --env production 2>/dev/null | grep -q "\"name\": \"$secret\""; then
      echo "Missing $secret — prompting:"
      pnpm --dir "$API_DIR" exec wrangler secret put "$secret" --env production
    fi
  done
fi

echo
echo "==> Apply D1 migrations (remote production)"
# database_name must match wrangler.toml [env.production]
DB_NAME="$(python3 - <<'PY'
import re, pathlib
text = pathlib.Path("apps/api/wrangler.toml").read_text()
# Prefer production env block database_name
prod = re.search(r'\[env\.production\][\s\S]*?database_name\s*=\s*"([^"]+)"', text)
if prod:
    print(prod.group(1)); raise SystemExit
m = re.search(r'database_name\s*=\s*"([^"]+)"', text)
print(m.group(1) if m else "seal-documents")
PY
)"
pnpm --dir "$API_DIR" exec wrangler d1 migrations apply "$DB_NAME" --env production --remote

echo
echo "==> Deploy API + web"
pnpm --dir "$API_DIR" run deploy
pnpm --dir "$WEB_DIR" run deploy

echo
echo "Done. Next:"
echo "  1. Point BETTER_AUTH_URL / APP_URL / ALLOWED_ORIGINS vars at your origins"
echo "  2. Create a user → API key → SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs --api <your-api>"
echo "  3. Optional: deploy mcp/anydoc/convert workers (see CONTRIBUTING.md)"
