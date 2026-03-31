import { mkdirSync } from "node:fs";
import path from "node:path";
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
  // Calls test_e2e_helpers:seedProSubscriptionForE2E via Convex HTTP API.
  // Non-fatal — tests degrade gracefully without pro plan.
  const { organizationSlug } = getTestWorkspaceConfig();
  const convexUrl = process.env.VITE_CONVEX_URL || "https://coordinated-lemur-768.convex.cloud";
  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (deployKey) {
    try {
      const res = await fetch(`${convexUrl}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${deployKey}`,
        },
        body: JSON.stringify({
          path: "test_e2e_helpers:seedProSubscriptionForE2E",
          args: { organizationSlug },
          format: "json",
        }),
      });
      if (!res.ok) {
        console.warn("[setup] seedProSubscriptionForE2E HTTP error:", res.status, await res.text());
      }
    } catch (err) {
      console.warn("[setup] seedProSubscriptionForE2E failed:", err);
    }
  } else {
    console.warn("[setup] CONVEX_DEPLOY_KEY not set — skipping pro subscription seed");
  }
});
