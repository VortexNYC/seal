import { type Page } from "@playwright/test";

import { extractOrganizationSlugFromUrl } from "./workspace-state";

type TestWorkspaceConfig = {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  organizationSlug: string;
};

export function getTestWorkspaceConfig(): TestWorkspaceConfig {
  const email =
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "seal-e2e@seal.nyc";
  const password =
    process.env.E2E_TEST_USER_PASSWORD ||
    process.env.TEST_USER_PASSWORD ||
    "SealE2ePassword123!";
  const defaultSlug = buildDefaultOrganizationSlug(email);

  return {
    email,
    password,
    name: process.env.E2E_TEST_USER_NAME || "Seal E2E",
    organizationName:
      process.env.E2E_TEST_ORGANIZATION_NAME ||
      process.env.TEST_ORGANIZATION_NAME ||
      "Seal E2E Workspace",
    organizationSlug:
      process.env.E2E_TEST_ORGANIZATION_SLUG ||
      process.env.TEST_ORGANIZATION_SLUG ||
      defaultSlug,
  };
}

/**
 * Sign in (or sign up + onboard) the Better-Auth test user.
 *
 * Better-Auth:
 * 1. Try the email+password sign-in form.
 * 2. If sign-in does not land authenticated (account does not exist yet), sign
 *    up via the sign-up form.
 * 3. If routed to onboarding, create the personal workspace.
 */
export async function signInTestUser(page: Page): Promise<void> {
  const config = getTestWorkspaceConfig();

  // Cold app boot can be slow; relax the per-action timeout for the auth flow.
  page.setDefaultTimeout(60000);

  await signInWithPassword(page, config);

  if (!isAuthenticatedUrl(page.url()) && !isWorkspaceHomeUrl(page.url())) {
    await signUpWithPassword(page, config);
  }

  // Force bootstrap so we observe onboarding vs home after session cookies land.
  await page.goto("/app", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page
    .waitForURL(/\/([\w-]+\/home|[\w-]+\/onboarding)/, {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});

  await completeOnboardingIfPresent(page, config);

  if (!isWorkspaceHomeUrl(page.url())) {
    await page.goto("/app", { waitUntil: "domcontentloaded" }).catch(() => {});
    await completeOnboardingIfPresent(page, config);
  }

  page.setDefaultTimeout(5000);

  await ensureAuthenticated(page);
  if (!isWorkspaceHomeUrl(page.url())) {
    throw new Error(
      `[E2E] Sign-in finished without workspace home. url=${page.url()}`
    );
  }
}

async function signInWithPassword(
  page: Page,
  config: TestWorkspaceConfig
): Promise<void> {
  await page
    .goto("/sign-in", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.fill('input[type="email"]', config.email).catch(() => {});
  await page.fill('input[type="password"]', config.password).catch(() => {});
  await page
    .click('button[type="submit"], button:has-text("Sign in")')
    .catch(() => {});
  await page
    .waitForURL(/\/([\w-]+\/home|onboarding)/, {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

async function signUpWithPassword(
  page: Page,
  config: TestWorkspaceConfig
): Promise<void> {
  await page
    .goto("/sign-up", { waitUntil: "domcontentloaded" })
    .catch(() => {});
  await page.getByLabel(/^name$/i).fill(config.name).catch(() => {});
  await page.getByLabel(/^email$/i).fill(config.email).catch(() => {});
  await page.getByLabel(/^password$/i).fill(config.password).catch(() => {});
  await page
    .getByLabel(/confirm password/i)
    .fill(config.password)
    .catch(() => {});
  await page
    .getByRole("button", { name: /create account/i })
    .click()
    .catch(() => {});
  await page
    .waitForURL(/\/([\w-]+\/home|onboarding)/, {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

async function completeOnboardingIfPresent(
  page: Page,
  config: TestWorkspaceConfig
): Promise<void> {
  if (!page.url().includes("/onboarding")) {
    return;
  }

  // Wait for either create form or workspace chooser to mount.
  await page
    .getByRole("heading", {
      name: /create your workspace|choose a workspace/i,
    })
    .first()
    .waitFor({ state: "visible", timeout: 15000 });

  // Newer onboarding: single "Create your workspace" form.
  const workspaceName = page.locator("#org-name");
  if (await workspaceName.isVisible().catch(() => false)) {
    await workspaceName.click();
    await workspaceName.fill("");
    await workspaceName.pressSequentially(config.organizationName, {
      delay: 20,
    });
    const slugField = page.locator("#org-slug");
    await slugField.click();
    await slugField.fill("");
    await slugField.pressSequentially(config.organizationSlug, { delay: 20 });
    await expectInputValue(page, workspaceName, config.organizationName);
    const continueBtn = page.getByRole("button", {
      name: /continue|create workspace/i,
    });
    for (let i = 0; i < 40; i++) {
      if (await continueBtn.isEnabled()) break;
      await page.waitForTimeout(100);
    }
    if (!(await continueBtn.isEnabled())) {
      throw new Error(
        `[E2E] Create workspace Continue stayed disabled after fill (name=${await workspaceName.inputValue()} slug=${await slugField.inputValue()})`
      );
    }
    await continueBtn.click();
    await page.waitForURL(/\/[\w-]+\/home/, {
      timeout: 30000,
      waitUntil: "domcontentloaded",
    });
    return;
  }

  // Prefer creating a workspace when the chooser is empty / create form shown.
  const createButton = page.getByRole("button", {
    name: /create (a new )?workspace/i,
  });
  if (await createButton.isVisible().catch(() => false)) {
    const nameField = page.getByLabel(/^name$/i);
    if (!(await nameField.isVisible().catch(() => false))) {
      await createButton.click().catch(() => {});
    }
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill(config.organizationName);
      const slugField = page.getByLabel(/^slug$/i);
      if (await slugField.isVisible().catch(() => false)) {
        await slugField.fill(config.organizationSlug);
      }
      await page
        .getByRole("button", { name: /^create workspace$/i })
        .click()
        .catch(() => {});
    }
  }

  // Pick existing workspace card if listed.
  const existing = page.getByRole("button", {
    name: new RegExp(config.organizationName, "i"),
  });
  if (await existing.isVisible().catch(() => false)) {
    await existing.click().catch(() => {});
  }

  await page
    .waitForURL(/\/[\w-]+\/home/, {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

/**
 * Re-enter the authenticated app bootstrap flow and only return once the page
 * has landed on a workspace home route.
 */
export async function ensureAuthenticatedWorkspaceHome(
  page: Page,
  preferredOrganizationSlug?: string,
  attempt = 0
): Promise<void> {
  if (attempt >= 2) {
    throw new Error(
      "[E2E] Failed to land on an authenticated workspace home route."
    );
  }
  {
    const config = getTestWorkspaceConfig();
    await page.goto("/app", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page
      .waitForURL(/\/([\w-]+\/home|[\w-]+\/onboarding|sign-in|app)/, {
        timeout: 10000,
        waitUntil: "domcontentloaded",
      })
      .catch(() => {});

    if (!isAuthenticatedUrl(page.url())) {
      await signInTestUser(page);
      await page
        .goto("/app", { waitUntil: "domcontentloaded" })
        .catch(() => {});
      await page
        .waitForURL(/\/([\w-]+\/home|[\w-]+\/onboarding|sign-in|app)/, {
          timeout: 12000,
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
    }

    if (page.url().includes("/onboarding")) {
      await completeOnboardingIfPresent(page, config);
    }

    if (!page.url().match(/\/[\w-]+\/home/)) {
      await page
        .goto("/app", { waitUntil: "domcontentloaded" })
        .catch(() => {});
      await page
        .waitForURL(/\/[\w-]+\/home/, {
          timeout: 12000,
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
    }

    const activeSlug = extractOrganizationSlugFromUrl(page.url());
    if (
      preferredOrganizationSlug &&
      activeSlug &&
      activeSlug !== preferredOrganizationSlug
    ) {
      await page
        .goto(`/${preferredOrganizationSlug}/home`, {
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
      await page
        .waitForURL(/\/[\w-]+\/home/, {
          timeout: 12000,
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
    }

    if (page.url().match(/\/[\w-]+\/home/)) {
      await ensureAuthenticated(page);
      return;
    }

    await page.waitForTimeout(500);
  }

  return ensureAuthenticatedWorkspaceHome(
    page,
    preferredOrganizationSlug,
    attempt + 1
  );
}

export function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    // /app is a bootstrap redirect, not a completed auth landing.
    return /\/([\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(
      pathname
    );
  } catch {
    return false;
  }
}

export function isWorkspaceHomeUrl(url: string): boolean {
  try {
    return /\/[\w-]+\/home(?:\/|$)/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function expectInputValue(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  expected: string
): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const value = await locator.inputValue().catch(() => "");
    if (value === expected) return;
    await locator.fill(expected);
    await page.waitForTimeout(50);
  }
  const finalValue = await locator.inputValue().catch(() => "");
  if (finalValue !== expected) {
    throw new Error(
      `[E2E] Input did not accept value. expected=${expected} actual=${finalValue}`
    );
  }
}

export async function ensureAuthenticated(page: Page): Promise<void> {
  if (isWorkspaceHomeUrl(page.url()) || isAuthenticatedUrl(page.url())) {
    return;
  }

  try {
    await page.waitForFunction(
      () => {
        try {
          const pathname = new URL(location.href).pathname;
          return /\/([\w-]+\/home|[\w-]+\/onboarding)/.test(pathname);
        } catch {
          return false;
        }
      },
      { timeout: 15000 }
    );
  } catch {
    if (page.isClosed()) {
      throw new Error("[E2E] Page closed before auth handshake completed");
    }
    const cookies = await page.context().cookies();
    const hasSession = cookies.some(
      (cookie) =>
        cookie.name.includes("session") || cookie.name.includes("better-auth")
    );
    if (!hasSession && !isAuthenticatedUrl(page.url())) {
      throw new Error(
        `[E2E] Auth handshake did not complete. url=${page.url()}`
      );
    }
  }
}

/**
 * Ensure workspace exists — drive onboarding UI if /app lands there.
 */
export async function ensureWorkspace(page: Page): Promise<void> {
  const config = getTestWorkspaceConfig();
  await completeOnboardingIfPresent(page, config);
}

function buildDefaultOrganizationSlug(email: string): string {
  const localPart = email.split("@")[0] ?? "seal-e2e";
  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "seal-e2e";
}
