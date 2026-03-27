import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { signInTestUser } from "../fixtures/auth-helpers";

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

  await signInTestUser(page);

  await page.context().storageState({ path: authStatePath });
});
