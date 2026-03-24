import type { Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type ClerkWindow = Window & {
  Clerk?: {
    session?: {
      getToken(options?: { template?: "convex"; skipCache?: boolean }): Promise<string | null>;
    } | null;
  };
};

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
    "sealtest001+clerk_test@example.com";
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

export async function ensureWorkspaceForAuthenticatedUser(page: Page): Promise<string> {
  const convexUrl = process.env.VITE_CONVEX_URL;

  if (!convexUrl) {
    throw new Error("missing VITE_CONVEX_URL envar for E2E workspace setup");
  }

  const convexToken = await waitForClerkConvexToken(page);

  if (!convexToken) {
    throw new Error("Failed to fetch Clerk Convex token for E2E workspace setup");
  }

  const workspace = getTestWorkspaceConfig();
  const convex = new ConvexHttpClient(convexUrl, {
    auth: convexToken,
    logger: false,
  });
  const ensurePersonalOrganization = makeFunctionReference<"mutation">(
    "organizations/mutations:ensurePersonalOrganization",
  );
  const hasOrganization = makeFunctionReference<"query">("check_membership:hasOrganization");

  await retry(
    async () => {
      await convex.mutation(ensurePersonalOrganization, {
        organizationName: workspace.organizationName,
        organizationSlug: workspace.organizationSlug,
      });
    },
    {
      attempts: 10,
      delayMs: 1500,
    },
  );

  const membership = await retry(async () => convex.query(hasOrganization, {}), {
    attempts: 10,
    delayMs: 1000,
    isComplete: (result) => Boolean(result.activeOrganizationSlug),
  });

  const activeOrganizationSlug = membership.activeOrganizationSlug;

  if (!activeOrganizationSlug) {
    throw new Error("Workspace setup completed without an active organization slug");
  }

  return activeOrganizationSlug;
}

export async function waitForClerkConvexToken(page: Page): Promise<string> {
  const token = await retry(
    async () =>
      page.evaluate(async () => {
        const clerk = (window as ClerkWindow).Clerk;
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
