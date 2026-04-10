import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts"],
    // Convex test files share global fixture state and only pass reliably when
    // Vitest runs them one worker at a time.
    maxWorkers: 1,
    // CI runners are significantly slower than local machines — the default 10s
    // hook timeout causes beforeEach DB setup to fail in tests that insert
    // multiple records (automated_reminders, expiration_sweep).
    hookTimeout: 30_000,
    server: {
      deps: {
        // Force Vite to transform zod as ESM instead of letting bun's native
        // runtime handle it (bun --bun breaks Zod v4's re-exports).
        inline: ["zod"],
      },
    },
  },
});
