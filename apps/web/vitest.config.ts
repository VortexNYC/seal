import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Deduplicate React to prevent dual-instance issues in tests.
      // The workspace can hoist a different React version than the root,
      // causing "Cannot read properties of null (reading 'useState')" errors.
      react: path.resolve(import.meta.dirname, "../../node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "../../node_modules/react-dom"),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
    server: {
      deps: {
        inline: ["zod"],
      },
    },
  },
});
