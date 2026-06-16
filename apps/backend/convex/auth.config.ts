import { createConvexAuthConfig } from "@plasmapos/auth/better-auth/server";

// Single-origin Better-Auth provider: this deployment signs AND validates
// its own tokens, issuer derived from CONVEX_SITE_URL (set by Convex on
// every deployment). No process.env references in the factory on purpose —
// Convex's deploy-time auth-config analyzer treats any reachable
// process.env.X as mandatory, which would break deploys to fresh deployments.
export const betterAuthConvexProvider = createConvexAuthConfig();

// Single-origin Better-Auth: this deployment signs and validates its own
// tokens.
export default {
  providers: [betterAuthConvexProvider],
};
