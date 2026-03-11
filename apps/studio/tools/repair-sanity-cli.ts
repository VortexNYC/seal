import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const TERM_SIZE_SHIM = `#!/bin/sh
set -eu

if command -v resize >/dev/null 2>&1; then
  if output="$(resize -u 2>/dev/null)"; then
    cols="$(printf '%s\n' "$output" | awk -F= '/^COLUMNS=/{gsub(/[^0-9]/, "", $2); print $2; exit}')"
    rows="$(printf '%s\n' "$output" | awk -F= '/^LINES=/{gsub(/[^0-9]/, "", $2); print $2; exit}')"
    if [ -n "$cols" ] && [ -n "$rows" ]; then
      printf '%s\n%s\n' "$cols" "$rows"
      exit 0
    fi
  fi
fi

if command -v tput >/dev/null 2>&1; then
  cols="$(tput cols 2>/dev/null || true)"
  rows="$(tput lines 2>/dev/null || true)"
  if [ -n "$cols" ] && [ -n "$rows" ]; then
    printf '%s\n%s\n' "$cols" "$rows"
    exit 0
  fi
fi

if [ -n "\${COLUMNS:-}" ] && [ -n "\${LINES:-}" ]; then
  printf '%s\n%s\n' "$COLUMNS" "$LINES"
  exit 0
fi

exit 1
`;

async function repairSanityCli(): Promise<void> {
  if (process.platform !== "darwin") {
    return;
  }

  const cliPackagePath = require.resolve("@sanity/cli/package.json");
  const termSizePath = path.join(path.dirname(cliPackagePath), "lib", "_chunks-cjs", "vendor", "macos", "term-size");

  try {
    await stat(termSizePath);
    await chmod(termSizePath, 0o755);
    return;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  // Published Sanity CLI packages reference this helper but do not ship it.
  await mkdir(path.dirname(termSizePath), { recursive: true });
  await writeFile(termSizePath, TERM_SIZE_SHIM, "utf8");
  await chmod(termSizePath, 0o755);
}

repairSanityCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sanity:repair] ${message}`);
  process.exitCode = 1;
});
