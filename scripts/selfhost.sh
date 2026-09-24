#!/usr/bin/env bash
# One-command self-host for Seal on your Cloudflare account.
# Uses wrangler auto-provision (D1 + R2) and the `selfhost` env — no Vortex IDs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }
info() { echo "==> $*"; }

need pnpm
need python3

API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
API_TOML="$API_DIR/wrangler.toml"

[[ -f "$API_TOML" ]] || die "missing $API_TOML"
grep -q '\[env\.selfhost\]' "$API_TOML" || die "apps/api/wrangler.toml missing [env.selfhost] — pull latest main"

info "Cloudflare auth"
who="$(pnpm --dir "$API_DIR" exec wrangler whoami 2>&1)" || die "run: pnpm exec wrangler login"
echo "$who" | head -20

# Selfhost uses seal-selfhost-* worker/D1/R2 names — safe beside hosted
# seal-api / seal-web. Still prefer a non-Vortex account for customer-shaped proof.
VORTEX_CF_ACCOUNT_ID="31bfc2c14a28e0a39e8b9e3c556a18be"
if echo "$who" | grep -q "$VORTEX_CF_ACCOUNT_ID"; then
  echo "NOTE: logged into the Vortex Cloudflare account."
  echo "      Deploying seal-selfhost-* (not production seal-api / seal-web)."
fi

ensure_secret() {
  local name="$1"
  if pnpm --dir "$API_DIR" exec wrangler secret list --env selfhost 2>/dev/null | grep -q "\"name\": \"$name\""; then
    echo "    $name already set"
    return 0
  fi
  if [[ -n "${!name:-}" ]]; then
    printf '%s' "${!name}" | pnpm --dir "$API_DIR" exec wrangler secret put "$name" --env selfhost
    return 0
  fi
  echo "    Missing $name — prompting (or export $name=… and re-run):"
  pnpm --dir "$API_DIR" exec wrangler secret put "$name" --env selfhost
}

info "Required secrets (BETTER_AUTH_SECRET, TOKEN_HASH_SECRET, INTERNAL_API_KEY, MCP_SIGNING_KEY)"
if [[ "${SEAL_SELFHOST_SKIP_SECRETS:-}" != "1" ]]; then
  for secret in BETTER_AUTH_SECRET TOKEN_HASH_SECRET INTERNAL_API_KEY; do
    ensure_secret "$secret"
  done
  # Upload tokens need an ES256 JWK; generate one if missing.
  if ! pnpm --dir "$API_DIR" exec wrangler secret list --env selfhost 2>/dev/null | grep -q '"name": "MCP_SIGNING_KEY"'; then
    if [[ -n "${MCP_SIGNING_KEY:-}" ]]; then
      printf '%s' "$MCP_SIGNING_KEY" | pnpm --dir "$API_DIR" exec wrangler secret put MCP_SIGNING_KEY --env selfhost
    else
      info "Generating MCP_SIGNING_KEY (ES256 JWK)"
      pnpm --dir "$API_DIR" exec node --input-type=module -e '
import { generateKeyPair, exportJWK } from "jose";
const { privateKey } = await generateKeyPair("ES256", { extractable: true });
const jwk = await exportJWK(privateKey);
jwk.alg = "ES256";
jwk.use = "sig";
process.stdout.write(JSON.stringify(jwk));
' | pnpm --dir "$API_DIR" exec wrangler secret put MCP_SIGNING_KEY --env selfhost
    fi
  else
    echo "    MCP_SIGNING_KEY already set"
  fi
fi

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
# seal-selfhost-api.<account>.workers.dev → seal-selfhost-web.<account>.workers.dev
if len(parts) >= 4 and parts[0] == "seal-selfhost-api":
    print("https://seal-selfhost-web." + ".".join(parts[1:]))
elif len(parts) >= 4 and parts[0] == "seal-api":
    # legacy name support
    print("https://seal-web." + ".".join(parts[1:]))
else:
    print("")
PY
}

API_OUT="$(mktemp)"
WEB_OUT="$(mktemp)"
trap 'rm -f "$API_OUT" "$WEB_OUT"' EXIT

info "Deploy API with account-scoped auth/CORS vars"
bash "$ROOT/scripts/selfhost-deploy-api.sh" | tee "$API_OUT"

API_URL="${SEAL_API_URL:-}"
WEB_URL="${SEAL_WEB_URL:-}"
if [[ -z "$API_URL" || -z "$WEB_URL" ]]; then
  eval "$(python3 - "$API_OUT" <<'PY'
import re, sys
text = open(sys.argv[1]).read()
api = re.search(r"^  API: (https://\S+)", text, re.M)
web = re.search(r"^  Web: (https://\S+)", text, re.M)
if api:
    print(f"API_URL={api.group(1)!r}")
if web:
    print(f"WEB_URL={web.group(1)!r}")
PY
)"
fi
[[ -n "${API_URL:-}" ]] || die "could not parse API URL from deploy output (set SEAL_API_URL=)"
[[ -n "${WEB_URL:-}" ]] || WEB_URL="$(derive_web_url "$API_URL")"
[[ -n "$WEB_URL" ]] || die "could not derive web workers.dev URL (set SEAL_WEB_URL=)"

info "Build + deploy web"
export VITE_API_URL="$API_URL"
export VITE_BETTER_AUTH_URL="$API_URL"
export VITE_APP_URL="$WEB_URL"
pnpm --dir "$WEB_DIR" run build:selfhost
pnpm --dir "$WEB_DIR" exec wrangler deploy --env selfhost | tee "$WEB_OUT"
PARSED_WEB="$(extract_workers_url "$WEB_OUT")"
if [[ -n "$PARSED_WEB" ]]; then
  WEB_URL="$PARSED_WEB"
fi

echo
echo "Done. Your Seal instance:"
echo "  Web:  $WEB_URL"
echo "  API:  $API_URL"
echo
echo "Next:"
echo "  1. Open the web URL → sign up → create a workspace"
echo "  2. Developer → API Keys → create a key (seal_…)"
echo "  3. SEAL_API_KEY=seal_… node scripts/smoke-prod.mjs --api $API_URL"
echo
echo "Optional later: Email Routing, anydoc, convert — see CONTRIBUTING.md"
echo "Custom domains: add routes under [env.selfhost] when you own DNS."
