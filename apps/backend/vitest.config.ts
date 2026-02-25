import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts"],
    server: {
      deps: {
        // Force Vite to transform zod as ESM instead of letting bun's native
        // runtime handle it (bun --bun breaks Zod v4's re-exports).
        inline: ["zod"],
      },
    },
  },
});
