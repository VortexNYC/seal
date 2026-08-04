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
 * Sign in (or sign up + onboard) the Better-Auth test user, then verify Convex
 * authentication is ready before the caller saves storage state.
 *
 * Better-Auth:
 * 1. Try the email+password sign-in form.
 * 2. If sign-in does not land authenticated (account does not exist yet), sign
 *    up via the sign-up form.
 * 3. If routed to onboarding, create the personal workspace.
 * 4. Land on a `/{slug}/home` route and poll Convex auth until ready.
 */
export async function signInTestUser(page: Page): Promise<void> {
  const config = getTestWorkspaceConfig();

  // Cold app boot can be slow; relax the per-action timeout for the auth flow.
  page.setDefaultTimeout(60000);

  await signInWithPassword(page, config);

  if (!isAuthenticatedUrl(page.url())) {
    await signUpWithPassword(page, config);
  }

  await completeOnboardingIfPresent(page, config);

  page.setDefaultTimeout(5000);

  await ensureConvexAuth(page);
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
  await page.fill('input[type="text"]', config.name).catch(() => {});
  await page.fill('input[type="email"]', config.email).catch(() => {});
  await page.fill('input[type="password"]', config.password).catch(() => {});
  await page
    .click('button[type="submit"], button:has-text("Create account")')
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
  _config: TestWorkspaceConfig
): Promise<void> {
  if (!page.url().includes("/onboarding")) {
    return;
  }
  await page.click('button:has-text("Create a new workspace")').catch(() => {});
  await page
    .waitForURL(/\/[\w-]+\/home/, {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

/**
 * Re-enter the authenticated app bootstrap flow and only return once the page
 * has landed on a workspace home route with a working Convex auth token.
 */
export async function ensureAuthenticatedWorkspaceHome(
  page: Page,
  preferredOrganizationSlug?: string
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
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
      await ensureConvexAuth(page);
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    "[E2E] Failed to land on an authenticated workspace home route."
  );
}

export function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/(app|[\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(
      pathname
    );
  } catch {
    return false;
  }
}

/**
 * Ensure the Convex client is authenticated by polling window.__convexClient.
 * Auth-mechanism agnostic: confirms the Better-Auth session token has propagated
 * into the Convex client. No mutations, no org creation.
 */
export async function ensureConvexAuth(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      window.__convexClient !== undefined && window.__convexApi !== undefined,
    { timeout: 8000 }
  );

  const maxAttempts = 20;
  const delayMs = 500;
  let authenticated = false;

  for (let i = 0; i < maxAttempts; i++) {
    // eslint-disable-next-line no-await-in-loop
    authenticated = await page.evaluate(async () => {
      try {
        const client = window.__convexClient;
        const api = window.__convexApi;

        if (!client || !api) return false;

        const result = await client.query(
          api.check_membership.hasOrganization,
          {}
        );
        return result !== undefined && result !== null;
      } catch {
        return false;
      }
    });

    if (authenticated) break;
    await page.waitForTimeout(delayMs);
  }

  if (!authenticated) {
    throw new Error(
      "[E2E] Timed out waiting for Convex authentication. " +
        "Ensure Better-Auth sign-in completes and the Convex client receives a token."
    );
  }
}

/**
 * Ensure workspace exists — called AFTER auth is saved, never blocks auth setup.
 * Wrapped in Promise.race with timeout so it never fails the test. Onboarding
 * already creates the workspace via the UI; this is a belt-and-suspenders path.
 */
export async function ensureWorkspace(page: Page): Promise<void> {
  const workspace = getTestWorkspaceConfig();

  await Promise.race([
    (async () => {
      try {
        await page.waitForFunction(
          () =>
            window.__convexClient !== undefined &&
            window.__convexApi !== undefined,
          { timeout: 10000 }
        );

        await page.evaluate(
          async ({ orgName, orgSlug }) => {
            const client = window.__convexClient;
            const api = window.__convexApi;

            if (!client || !api) throw new Error("Convex not ready");

            await client.mutation(
              api.organizations.mutations.ensurePersonalOrganization,
              {
                organizationName: orgName,
                organizationSlug: orgSlug,
              }
            );
          },
          {
            orgName: workspace.organizationName,
            orgSlug: workspace.organizationSlug,
          }
        );
      } catch {
        // Org may already exist or Convex not ready — both acceptable
      }
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, 15000)),
  ]);
}

function buildDefaultOrganizationSlug(email: string): string {
  const localPart = email.split("@")[0] ?? "seal-e2e";
  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "seal-e2e";
}
