import { createConvexAuthConfig } from "@plasmapos/vortex-auth/better-auth/server";

// Single-origin Better-Auth provider: this deployment signs AND validates
// its own tokens, issuer derived from CONVEX_SITE_URL (set by Convex on
// every deployment). No process.env references in the factory on purpose —
// Convex's deploy-time auth-config analyzer treats any reachable
// process.env.X as mandatory, which would break deploys to fresh deployments.
export const betterAuthConvexProvider = createConvexAuthConfig();

// ADDITIVE during the migration: keep the Clerk provider live AND add the
// Better-Auth provider so both token types validate while we cut over.
// Clerk is removed in P6 once vortex-auth is proven live.
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
    betterAuthConvexProvider,
  ],
};
