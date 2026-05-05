import { mkdirSync } from "node:fs";
import path from "node:path";

import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { signInTestUser } from "../fixtures/auth-helpers";
import { authStatePath } from "../fixtures/paths";
import { assertAppEnv, assertAuthEnv } from "../fixtures/preflight";

setup.describe.configure({ mode: "serial" });

setup("initialize clerk testing environment", async () => {
  assertAppEnv();
  assertAuthEnv();
  // @clerk/testing reads CLERK_PUBLISHABLE_KEY only; mirror from prefixed variants the app already uses.
  process.env.CLERK_PUBLISHABLE_KEY ||=
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
    "";
  await clerkSetup();
});

setup("authenticate clerk test user", async ({ page }) => {
  setup.setTimeout(60000);
  mkdirSync(path.dirname(authStatePath), { recursive: true });

  await signInTestUser(page);
  await page.context().storageState({ path: authStatePath });

  console.info(`[setup] Auth state saved to ${authStatePath}`);
});
