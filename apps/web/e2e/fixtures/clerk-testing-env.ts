const CLERK_PUBLISHABLE_KEY_ENV_NAMES = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "VITE_CLERK_PUBLISHABLE_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "REACT_APP_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
] as const;

export function canUseClerkTestingHelpers(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const hasPublishableKey = CLERK_PUBLISHABLE_KEY_ENV_NAMES.some((name) => Boolean(env[name]));
  const hasTestingCredential = Boolean(env.CLERK_SECRET_KEY || env.CLERK_TESTING_TOKEN);
  const testEmail = env.E2E_TEST_USER_EMAIL || env.TEST_USER_EMAIL;
  const isClerkTestEmail = testEmail?.includes("+clerk_test") ?? false;

  return hasPublishableKey && hasTestingCredential && isClerkTestEmail;
}
