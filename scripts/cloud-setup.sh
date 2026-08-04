#!/usr/bin/env bash
# Cloud agent bootstrap for Seal. Convex `_generated` is committed.
set -euo pipefail

if [ -n "${NODE_AUTH_TOKEN:-}" ]; then
  pnpm config set "//npm.pkg.github.com/:_authToken" "$NODE_AUTH_TOKEN"
elif command -v op >/dev/null 2>&1; then
  echo "==> WARN: NODE_AUTH_TOKEN unset; private @vortexnyc packages may 401"
fi

echo "==> pnpm version: $(pnpm --version)"
echo "==> Installing dependencies (pnpm install --frozen-lockfile)"
pnpm install --frozen-lockfile

echo "==> Setup complete. Verify with: pnpm run project-kit:check && pnpm run prepush:check"
