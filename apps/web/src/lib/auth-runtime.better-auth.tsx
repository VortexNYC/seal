import { createBetterAuthConvexClient } from "@plasmapos/vortex-auth/better-auth/client";
import {
  createVortexAuthEventCapture,
  createVortexAuthFlowStorage,
  createVortexAuthRoutePaths,
  createVortexBetterAuthRuntime,
  type VortexBetterAuthClient,
} from "@plasmapos/vortex-auth/react";
/**
 * Seal vortex-auth (Better-Auth) web runtime — P4 foundation.
 *
 * Mirrors crm's apps/web/src/lib/auth-runtime.better-auth.tsx. Built
 * ADDITIVELY: this module is not yet wired into main.tsx (that swap is the
 * P4 cutover, which replaces ClerkProvider + ConvexProviderWithClerk with
 * AuthRuntimeProvider in one dev-browser-tested unit). Exposes the app auth
 * hooks the route/component swaps will consume.
 */
import { api } from "@seal/backend/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import posthog from "posthog-js";
import type { ReactNode } from "react";

const betterAuthBaseUrl = (import.meta.env.VITE_BETTER_AUTH_URL as string | undefined) ?? "";
const authFlow = createVortexAuthFlowStorage({ storageKeyPrefix: "seal.auth" });

export const authRoutePaths = createVortexAuthRoutePaths();

const betterAuthClient: VortexBetterAuthClient | null =
  betterAuthBaseUrl.length > 0
    ? createBetterAuthConvexClient({
        baseURL: betterAuthBaseUrl,
        fetchOptions: {
          credentials: "include",
        },
      })
    : null;

export const runtime = createVortexBetterAuthRuntime({
  authClient: betterAuthClient,
  betterAuthBaseUrl,
  signInPath: authRoutePaths.signInPath,
  signUpPath: authRoutePaths.signUpPath,
  copy: {
    signInTitle: "Sign in",
    signInDescription: "Access Seal with your workspace account.",
    signInUnavailableTitle: "Sign-in is unavailable",
    signInUnavailableDescription: "Seal couldn't load the authentication runtime for this page.",
    signUpTitle: "Create account",
    signUpDescription: "Create your account, then continue into your Seal workspace.",
    signUpUnavailableTitle: "Sign-up is unavailable",
    signUpUnavailableDescription: "Seal couldn't load the authentication runtime for this page.",
  },
});

export function AuthRuntimeProvider(args: { children: ReactNode; convex: ConvexReactClient }) {
  return (
    <runtime.AuthRuntimeProvider
      convex={args.convex}
      identityProvisioner={
        <runtime.BetterAuthConvexIdentityProvisioner
          getCurrentUser={api.users.getCurrentUser}
          provisionCurrentUser={api.users.provisionCurrentBetterAuthUser}
        />
      }
    >
      {args.children}
    </runtime.AuthRuntimeProvider>
  );
}

export const useAppAuth = runtime.useAppAuth;
export const useAppUser = runtime.useAppUser;
export const useAppAuthActions = runtime.useAppAuthActions;
export const {
  clearPendingPostSignUpSync,
  consumePendingAuthFlow,
  markPendingAuthFlow,
  markPendingPostSignUpSync,
  toSafeRedirectPath,
} = authFlow;
export const captureAuthEvent = createVortexAuthEventCapture(
  (event: string, properties?: Record<string, unknown>) => posthog.capture(event, properties),
);
