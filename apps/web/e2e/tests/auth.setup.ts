import { mkdirSync } from "node:fs";
import path from "node:path";

import { test as setup } from "@playwright/test";

import { signInTestUser } from "../fixtures/auth-helpers";
import { authStatePath } from "../fixtures/paths";
import { assertAppEnv, assertAuthEnv } from "../fixtures/preflight";

setup.describe.configure({ mode: "serial" });

setup("authenticate better-auth test user", async ({ page }) => {
  setup.setTimeout(90000);
  assertAppEnv();
  assertAuthEnv();

  mkdirSync(path.dirname(authStatePath), { recursive: true });

  await signInTestUser(page);
  await page.context().storageState({ path: authStatePath });

  console.info(`[setup] Auth state saved to ${authStatePath}`);
});
