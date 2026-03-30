import { clerk } from "@clerk/testing/playwright";
import { expect, type Page } from "@playwright/test";

type TestWorkspaceConfig = {
  email: string;
  emailCode: string;
  organizationName: string;
  organizationSlug: string;
};

export function getTestWorkspaceConfig(): TestWorkspaceConfig {
  const email =
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "seal-e2e+clerk_test@example.com";
  const emailCode = process.env.E2E_TEST_EMAIL_CODE || process.env.TEST_EMAIL_CODE || "424242";
  const defaultSlug = buildDefaultOrganizationSlug(email);

  return {
    email,
    emailCode,
    organizationName:
      process.env.E2E_TEST_ORGANIZATION_NAME ||
      process.env.TEST_ORGANIZATION_NAME ||
      "Seal E2E Workspace",
    organizationSlug:
      process.env.E2E_TEST_ORGANIZATION_SLUG || process.env.TEST_ORGANIZATION_SLUG || defaultSlug,
  };
}

/**
 * Sign in a test user following Clerk's official Playwright testing protocol,
 * then verify Convex authentication is ready before saving state.
 *
 * Pattern ported from Catapult project — keep this simple:
 * 1. Navigate to unprotected page that loads Clerk
 * 2. clerk.signIn() (internally calls setupClerkTestingToken)
 * 3. Navigate to app, wait for authenticated URL
 * 4. Poll Convex auth until ready
 * 5. Done — no org creation here
 */
export async function signInTestUser(page: Page): Promise<void> {
  const { email: testEmail } = getTestWorkspaceConfig();

  // Clerk docs: navigate to an unprotected page that loads Clerk first
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // clerk.signIn() internally calls setupClerkTestingToken()
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: testEmail,
    },
  });

  // Navigate to the authenticated app area
  await page.goto("/app", { waitUntil: "domcontentloaded" });

  // Wait for the app to land on a workspace page (flexible match)
  await page.waitForURL(/\/(app|[\w-]+\/home|[\w-]+\/onboarding)/, {
    timeout: 10000,
    waitUntil: "domcontentloaded",
  });

  // Wait for Convex client to be ready and authenticated (ported from Catapult)
  await ensureConvexAuth(page);
}

export function isAuthenticatedUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/(app|[\w-]+\/home|[\w-]+\/onboarding\/choose-organization)/.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Ensure Convex client is authenticated by polling window.__convexClient.
 * Falls back to Clerk session token check if __convexClient isn't exposed.
 *
 * Ported from Catapult: polls a lightweight query to confirm the auth token
 * has propagated from Clerk → Convex. No mutations, no org creation.
 */
export async function ensureConvexAuth(page: Page): Promise<void> {
  // First wait for the Convex client and API to be exposed on window
  try {
    await page.waitForFunction(
      // biome-ignore lint: window globals are untyped in browser evaluate context
      () => (window as any).__convexClient !== undefined && (window as any).__convexApi !== undefined,
      { timeout: 8000 },
    );
  } catch {
    // If __convexClient isn't exposed, fall back to Clerk token check
    console.warn("[E2E] __convexClient not on window, falling back to Clerk token polling");
    await waitForClerkConvexToken(page);
    return;
  }

  // Poll for authentication by attempting a lightweight query
  const maxAttempts = 20;
  const delayMs = 500;
  let authenticated = false;

  for (let i = 0; i < maxAttempts; i++) {
    // eslint-disable-next-line no-await-in-loop
    authenticated = await page.evaluate(async () => {
      try {
        // biome-ignore lint: window globals are untyped in browser evaluate context
        const client = (window as any).__convexClient;
        // biome-ignore lint: window globals are untyped in browser evaluate context
        const api = (window as any).__convexApi;

        if (!client || !api) return false;

        const result = await client.query(api.check_membership.hasOrganization, {});
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
        "Ensure Clerk auth completes and Convex client receives token.",
    );
  }
}

/**
 * Ensure workspace exists — called AFTER auth is saved, never blocks auth setup.
 * Wrapped in Promise.race with timeout so it never fails the test.
 */
export async function ensureWorkspace(page: Page): Promise<void> {
  const workspace = getTestWorkspaceConfig();

  const result = await Promise.race([
    (async () => {
      try {
        await page.waitForFunction(
          // biome-ignore lint: window globals are untyped in browser evaluate context
          () => (window as any).__convexClient !== undefined && (window as any).__convexApi !== undefined,
          { timeout: 10000 },
        );

        await page.evaluate(
          async ({ orgName, orgSlug }) => {
            // biome-ignore lint: window globals are untyped in browser evaluate context
            const client = (window as any).__convexClient;
            // biome-ignore lint: window globals are untyped in browser evaluate context
            const api = (window as any).__convexApi;

            if (!client || !api) throw new Error("Convex not ready");

            await client.mutation(api.organizations.mutations.ensurePersonalOrganization, {
              organizationName: orgName,
              organizationSlug: orgSlug,
            });
          },
          { orgName: workspace.organizationName, orgSlug: workspace.organizationSlug },
        );

        return { success: true, message: "Workspace ensured" };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, message: msg };
      }
    })(),
    new Promise<{ success: false; message: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, message: "Workspace setup timeout (15s)" }), 15000),
    ),
  ]);

  if (!result.success) {
    const lowerMsg = result.message.toLowerCase();
    if (lowerMsg.includes("already") || lowerMsg.includes("duplicate")) {
      console.log("⚠️  Workspace setup skipped (already exists)");
    } else {
      console.log("⚠️  Workspace setup skipped:", result.message);
    }
  } else {
    console.log("✅ Workspace ensured");
  }
}

/**
 * Fallback: wait for Clerk to issue a Convex token via window.Clerk.session
 */
export async function waitForClerkConvexToken(page: Page): Promise<string> {
  const token = await retry(
    async () =>
      page.evaluate(async () => {
        const clerk = (
          window as Window & {
            Clerk?: {
              session?: {
                getToken(options?: {
                  template?: "convex";
                  skipCache?: boolean;
                }): Promise<string | null>;
              } | null;
            };
          }
        ).Clerk;
        return (await clerk?.session?.getToken({ template: "convex", skipCache: true })) ?? null;
      }),
    {
      attempts: 10,
      delayMs: 500,
      isComplete: (value) => typeof value === "string" && value.length > 0,
    },
  );

  if (!token) {
    throw new Error("Failed to fetch Clerk Convex token for E2E workspace setup");
  }

  return token;
}

async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    delayMs: number;
    isComplete?: (value: T) => boolean;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const result = await fn();
      if (!options.isComplete || options.isComplete(result)) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < options.attempts) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Retry operation did not complete successfully");
}

function buildDefaultOrganizationSlug(email: string): string {
  const localPart = email.split("@")[0] ?? "seal-e2e";
  const slug = localPart
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "seal-e2e";
}
