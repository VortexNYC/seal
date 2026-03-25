import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Force a single copy of React so tests never hit "Invalid hook call"
      // caused by mismatched React instances between components and react-dom.
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
