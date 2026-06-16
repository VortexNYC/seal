// Thin local re-export of Better-Auth identity helpers from
// @plasmapos/vortex-auth/better-auth so feature code doesn't import
// the package path directly. Centralizing here makes a future
// identity-provider migration a one-file change.
export {
  buildBetterAuthIdentityId,
  buildBetterAuthTokenIdentifier,
  getBetterAuthIdentityIssuer,
  getBetterAuthIdentityProvider,
} from "@plasmapos/auth/better-auth";
