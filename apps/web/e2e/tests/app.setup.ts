import { test as setup } from "@playwright/test";

import { ensureWorkspace, getTestWorkspaceConfig } from "../fixtures/auth-helpers";
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

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/app", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page
      .waitForURL(/\/[\w-]+\/(home|onboarding)/, {
        timeout: 10000,
        waitUntil: "domcontentloaded",
      })
      .catch(() => {});

    const activeSlug = extractOrganizationSlugFromUrl(page.url());
    if (activeSlug) {
      organizationSlug = activeSlug;
      break;
    }
  }

  writeCachedWorkspaceSlug(organizationSlug);
  console.info(`[setup] Active workspace slug: ${organizationSlug}`);
});
