import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { ensureWorkspace, signInTestUser } from "../fixtures/auth-helpers";

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
  console.log("✅ Auth state saved to", authStatePath);

  // Workspace setup happens AFTER auth is saved, never blocks tests.
  // The org is persistent in the test deployment so this is usually a no-op.
  console.log("🏗️  Ensuring workspace exists...");
  await ensureWorkspace(page);
});
