// Thin local re-export of Better-Auth identity helpers from
// @vortexnyc/vortex-auth/better-auth so feature code doesn't import
// the package path directly. Centralizing here makes a future
// identity-provider migration a one-file change.
export {
  buildBetterAuthIdentityId,
  buildBetterAuthTokenIdentifier,
  getBetterAuthIdentityIssuer,
  getBetterAuthIdentityProvider,
} from "@vortexnyc/auth/better-auth";
