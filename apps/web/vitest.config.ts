import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      react: path.resolve(import.meta.dirname, "../../node_modules/react"),
      "react-dom": path.resolve(
        import.meta.dirname,
        "../../node_modules/react-dom",
      ),
    },
  },
  test: {
    environment: "jsdom",
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
