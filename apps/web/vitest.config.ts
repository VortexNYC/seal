import { createRequire } from "node:module";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);

// Resolve react from react-dom's perspective to guarantee a single copy.
// Without this, the monorepo can hoist different versions of react into
// apps/web/node_modules vs the root, causing "Cannot read properties of
// null (reading 'useState')" when react-dom's internal dispatcher doesn't
// match the react copy a test component imports.
const reactDomDir = path.dirname(require.resolve("react-dom/package.json"));
const reactDir = path.dirname(
  createRequire(path.join(reactDomDir, "package.json")).resolve("react")
);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      react: reactDir,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "e2e/**/*.test.ts"],
    globals: false,
    server: {
      deps: {
        inline: ["zod"],
      },
    },
  },
});
