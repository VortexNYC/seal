import { canUseClerkTestingHelpers } from "./clerk-testing-env";
import { describeConvexE2eTarget } from "./convex-test-api";

let hasLoggedPreflight = false;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[E2E preflight] Missing required environment variable: ${name}`);
  }
  return value;
}

function logResolvedEnvironment(scope: string): void {
  if (hasLoggedPreflight) {
    return;
  }

  const convexTarget = describeConvexE2eTarget();
  const clerkEmail = process.env.E2E_TEST_USER_EMAIL || process.env.TEST_USER_EMAIL || "<missing>";
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5180";

  console.info(`[setup:${scope}] Base URL: ${baseUrl}`);
  console.info(
    `[setup:${scope}] Convex target: ${convexTarget.deploymentName} (${convexTarget.convexUrl})`,
  );
  console.info(`[setup:${scope}] Clerk test user: ${clerkEmail}`);

  hasLoggedPreflight = true;
}

export function assertAppEnv(): void {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL || process.env.VITE_APP_URL || "http://localhost:5180";
  if (!baseUrl.trim()) {
    throw new Error("[E2E preflight] Missing PLAYWRIGHT_BASE_URL / VITE_APP_URL for app setup");
  }
  logResolvedEnvironment("app");
}

export function assertAuthEnv(): void {
  const testEmail = requireEnv("E2E_TEST_USER_EMAIL");
  if (!testEmail.includes("+clerk_test")) {
    throw new Error(
      `[E2E preflight] E2E_TEST_USER_EMAIL must be a Clerk testing address. Received: ${testEmail}`,
    );
  }

  if (process.env.CI && !canUseClerkTestingHelpers()) {
    throw new Error(
      "[E2E preflight] Clerk testing helpers are not fully configured in CI. Need publishable key plus CLERK_SECRET_KEY or CLERK_TESTING_TOKEN.",
    );
  }

  logResolvedEnvironment("auth");
}

export function assertBackendEnv(): void {
  requireEnv("VITE_CONVEX_URL");
  requireEnv("CONVEX_DEPLOY_KEY");
  logResolvedEnvironment("backend");
}
