#!/usr/bin/env bash
# Deploy seal-selfhost-api with account-scoped APP_URL / BETTER_AUTH_URL / ALLOWED_ORIGINS.
# Plain `wrangler deploy --env selfhost` leaves bare *.workers.dev placeholders and
# breaks signing links — always use this script (or `pnpm selfhost`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT/apps/api"

die() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }

extract_workers_url() {
  python3 - "$1" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
matches = re.findall(r"https://[a-zA-Z0-9.-]+\.workers\.dev", text)
print(matches[-1].rstrip("/") if matches else "")
PY
}

derive_web_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
host = urlparse(sys.argv[1]).hostname or ""
parts = host.split(".")
if len(parts) >= 4 and parts[0] == "seal-selfhost-api":
    print("https://seal-selfhost-web." + ".".join(parts[1:]))
elif len(parts) >= 4 and parts[0] == "seal-api":
    print("https://seal-web." + ".".join(parts[1:]))
else:
    print("")
PY
}

is_placeholder() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
host = (urlparse(sys.argv[1]).hostname or "").lower()
import re
print("1" if re.match(r"^(seal-selfhost-(?:api|web)|seal-(?:api|web))\.workers\.dev$", host) else "0")
PY
}

API_OUT="$(mktemp)"
HEALTH_JSON="$(mktemp)"
trap 'rm -f "$API_OUT" "$HEALTH_JSON"' EXIT

info "Apply D1 migrations (binding D1)"
pnpm --dir "$API_DIR" exec wrangler d1 migrations apply D1 --remote --env selfhost

info "Deploy API (may briefly use placeholder vars from wrangler.toml)"
pnpm --dir "$API_DIR" exec wrangler deploy --env selfhost | tee "$API_OUT"

API_URL="${SEAL_API_URL:-$(extract_workers_url "$API_OUT")}"
[[ -n "$API_URL" ]] || die "could not parse API workers.dev URL (set SEAL_API_URL=)"

WEB_URL="${SEAL_WEB_URL:-$(derive_web_url "$API_URL")}"
[[ -n "$WEB_URL" ]] || die "could not derive web workers.dev URL (set SEAL_WEB_URL=)"

if [[ "$(is_placeholder "$API_URL")" == "1" ]] || [[ "$(is_placeholder "$WEB_URL")" == "1" ]]; then
  die "resolved URLs are still bare placeholders (api=$API_URL web=$WEB_URL). Set SEAL_API_URL / SEAL_WEB_URL to the account-scoped *.workers.dev hosts."
fi

info "Redeploy with auth/CORS vars → $API_URL / $WEB_URL"
pnpm --dir "$API_DIR" exec wrangler deploy --env selfhost \
  --var "BETTER_AUTH_URL:${API_URL}" \
  --var "APP_URL:${WEB_URL}" \
  --var "ALLOWED_ORIGINS:${WEB_URL}"

info "Verify /health rejects placeholder APP_URL"
# CF edge can lag a second behind version activation
for _ in 1 2 3 4 5; do
  code="$(curl -sS -o "$HEALTH_JSON" -w "%{http_code}" "$API_URL/health" || true)"
  if [[ "$code" == "200" ]]; then
    break
  fi
  sleep 2
done
if [[ "${code:-}" != "200" ]]; then
  die "/health returned HTTP ${code:-err} after deploy (body=$(head -c 240 "$HEALTH_JSON")). APP_URL vars likely did not stick — redeploy with --var or set SEAL_API_URL/SEAL_WEB_URL."
fi

echo
echo "Selfhost API ready:"
echo "  API: $API_URL"
echo "  Web: $WEB_URL"
