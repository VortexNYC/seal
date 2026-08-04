import { describeConvexE2eTarget } from "./convex-test-api";

let hasLoggedPreflight = false;

function requireAnyEnv(primaryName: string, fallbackName: string): string {
  const primaryValue = process.env[primaryName]?.trim();
  if (primaryValue) {
    return primaryValue;
  }

  const fallbackValue = process.env[fallbackName]?.trim();
  if (fallbackValue) {
    return fallbackValue;
  }

  throw new Error(
    `[E2E preflight] Missing required Vortex Auth test credential: ${primaryName} or ${fallbackName}`
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[E2E preflight] Missing required environment variable: ${name}`
    );
  }
  return value;
}

function logResolvedEnvironment(scope: string): void {
  if (hasLoggedPreflight) {
    return;
  }

  const convexTarget = describeConvexE2eTarget();
  const testEmail =
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "<missing>";
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5180";

  console.info(`[setup:${scope}] Base URL: ${baseUrl}`);
  console.info(
    `[setup:${scope}] Convex target: ${convexTarget.deploymentName} (${convexTarget.convexUrl})`
  );
  console.info(`[setup:${scope}] Test user: ${testEmail}`);

  hasLoggedPreflight = true;
}

export function assertAppEnv(): void {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.VITE_APP_URL ||
    "http://localhost:5180";
  if (!baseUrl.trim()) {
    throw new Error(
      "[E2E preflight] Missing PLAYWRIGHT_BASE_URL / VITE_APP_URL for app setup"
    );
  }
  logResolvedEnvironment("app");
}

export function assertAuthEnv(): void {
  requireAnyEnv("E2E_TEST_USER_EMAIL", "TEST_USER_EMAIL");
  requireAnyEnv("E2E_TEST_USER_PASSWORD", "TEST_USER_PASSWORD");
  logResolvedEnvironment("auth");
}

export function assertBackendEnv(): void {
  requireEnv("VITE_CONVEX_URL");
  requireEnv("CONVEX_DEPLOY_KEY");
  logResolvedEnvironment("backend");
}
