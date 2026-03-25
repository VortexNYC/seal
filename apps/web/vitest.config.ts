import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Pin React to a single copy — avoids "invalid hook call" in tests
      // caused by apps/web/node_modules/react (19.2.4) shadowing the root
      // node_modules/react (19.2.3) that react-dom is linked against.
      react: path.resolve(import.meta.dirname, "../../node_modules/react"),
      "react-dom": path.resolve(import.meta.dirname, "../../node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
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
