import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test as setup, expect } from "@playwright/test";

import { ensureWorkspaceForAuthenticatedUser, performLogin } from "../fixtures/auth-helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authStatePath = path.resolve(__dirname, "../../playwright/.clerk/user.json");

setup("authenticate clerk test user", async ({ page }) => {
  mkdirSync(path.dirname(authStatePath), { recursive: true });
  await performLogin(page);

  const organizationSlug = await ensureWorkspaceForAuthenticatedUser(page);

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(`/${organizationSlug}/home$`), { timeout: 30000 });
  await expect(page).toHaveURL(new RegExp(`/${organizationSlug}/home$`), { timeout: 30000 });

  await page.context().storageState({ path: authStatePath });
});
