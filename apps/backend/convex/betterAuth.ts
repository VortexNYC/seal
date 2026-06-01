import { createBetterAuthConvexRuntime } from "@plasmapos/vortex-auth/better-auth/convex";
import type { BetterAuthConvexRuntime } from "@plasmapos/vortex-auth/better-auth/convex";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { betterAuthConvexProvider } from "./auth.config";
import { authComponent as consumerAuthComponent } from "./betterAuthClient";

const betterAuthRuntime: BetterAuthConvexRuntime<DataModel> =
  createBetterAuthConvexRuntime<DataModel>({
    components: {
      betterAuth: components.betterAuth,
    },
    authComponent: consumerAuthComponent,
    authProvider: betterAuthConvexProvider,
    refs: {
      upsertUserFromBetterAuth: internal.users.upsertFromBetterAuth,
      provisionIdentityFromIdentity: components.vortexAuth.identity.provisionFromIdentity,
      // rateLimitAuthRequest intentionally omitted for P0 (pile pattern) —
      // the runtime's built-in rateLimit below still applies.
    },
    twoFactor: {
      enabled: true,
      issuer: "Seal",
    },
    // Captcha is a PROVEN opt-in capability (Cloudflare Turnstile,
    // sign-up/reset scoped). Kept DISABLED on the shared dev deployment
    // because it requires every caller to present an x-captcha-response
    // token, which would break the headless proof suite. Production opts
    // in with a real secretKey.
    captcha: {
      enabled: false,
      secretKey: "1x0000000000000000000000000000000AA",
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
    },
    trustedOrigins: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      // portless dev origin used by the test protocol.
      "http://seal.localhost:1355",
      // Staging + production web app origins.
      "https://app.seal.nyc",
      "https://staging.seal.nyc",
    ],
  });

export const authComponent = betterAuthRuntime.authComponent;
export const createAuth = betterAuthRuntime.createAuth;
export const registerAuthRoutes = betterAuthRuntime.registerRoutes;
export const resolveTrustedOrigins = betterAuthRuntime.resolveTrustedOrigins;
