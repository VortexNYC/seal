import { mkdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { ensureWorkspace, getTestWorkspaceConfig, signInTestUser } from "../fixtures/auth-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authStatePath = path.resolve(__dirname, "../../playwright/.clerk/user.json");

// Clerk's official protocol: clerkSetup() must run first, serially, to obtain
// a Testing Token that bypasses Cloudflare bot detection for all subsequent tests.
setup.describe.configure({ mode: "serial" });

setup("initialize clerk testing environment", async () => {
  await clerkSetup();
});

setup("authenticate clerk test user", async ({ page }) => {
  mkdirSync(path.dirname(authStatePath), { recursive: true });

  // Sign in and verify Convex auth is ready
  await signInTestUser(page);

  // Save auth state FIRST — this is what tests depend on
  await page.context().storageState({ path: authStatePath });

  // Workspace setup happens AFTER auth is saved, never blocks tests.
  // The org is persistent in the test deployment so this is usually a no-op.
  await ensureWorkspace(page);

  // Seed a pro subscription so invite button / document quota are enabled.
  // Only runs on the E2E test deployment (coordinated-lemur-768). No-ops if
  // subscription already active. Uses bunx convex run so it can call an
  // internalMutation without exposing it as a public API.
  const { organizationSlug } = getTestWorkspaceConfig();
  const convexDeployment = process.env.CONVEX_DEPLOYMENT || "dev:coordinated-lemur-768";
  try {
    execFileSync(
      "bunx",
      [
        "convex",
        "run",
        "test_e2e_helpers:seedProSubscriptionForE2E",
        JSON.stringify({ organizationSlug }),
        "--deployment",
        convexDeployment,
      ],
      { stdio: "pipe" },
    );
  } catch {
    // Non-fatal — tests degrade gracefully without pro plan
    console.warn("[setup] seedProSubscriptionForE2E failed — team invite tests will be skipped");
  }
});
