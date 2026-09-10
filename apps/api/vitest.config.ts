import path from "node:path";

import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const migrationsPath = path.join(import.meta.dirname ?? ".", "migrations");
const migrations = await readD1Migrations(migrationsPath);

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      remoteBindings: false,
      miniflare: {
        compatibilityDate: "2026-07-30",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          TEST_MIGRATIONS: migrations,
          BETTER_AUTH_SECRET: "test-better-auth-secret-do-not-use-in-prod",
          TOKEN_HASH_SECRET: "test-token-hash-secret-do-not-use-in-prod",
          BETTER_AUTH_URL: "http://localhost:8787",
          ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
          EMAIL_FROM: "test@example.com",
        },
      },
    }),
  ],
  test: {
    globals: true,
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
