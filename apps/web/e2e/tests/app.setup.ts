import { test as setup } from "@playwright/test";

import {
  ensureWorkspace,
  getTestWorkspaceConfig,
} from "../fixtures/auth-helpers";
import { authStatePath } from "../fixtures/paths";
import { assertAppEnv } from "../fixtures/preflight";
import {
  extractOrganizationSlugFromUrl,
  writeCachedWorkspaceSlug,
} from "../fixtures/workspace-state";

setup.use({ storageState: authStatePath });
setup.describe.configure({ mode: "serial" });

setup("resolve active workspace slug", async ({ page }) => {
  assertAppEnv();

  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await ensureWorkspace(page);

  let organizationSlug = getTestWorkspaceConfig().organizationSlug;

  const resolveActiveSlug = async (attempt: number): Promise<string | null> => {
    if (attempt >= 3) return null;
    await page.goto("/app", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page
      .waitForURL(/\/[\w-]+\/(home|onboarding)/, {
        timeout: 10000,
        waitUntil: "domcontentloaded",
      })
      .catch(() => {});

    const activeSlug = extractOrganizationSlugFromUrl(page.url());
    if (activeSlug) return activeSlug;
    return resolveActiveSlug(attempt + 1);
  };

  organizationSlug = (await resolveActiveSlug(0)) ?? organizationSlug;

  writeCachedWorkspaceSlug(organizationSlug);
  console.info(`[setup] Active workspace slug: ${organizationSlug}`);
});
