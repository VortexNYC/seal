import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { createBetterAuthUserSyncTriggers } from "@vortexnyc/auth/better-auth/convex";

import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// The createClient seam lives in the CONSUMER module (not inside the
// vortex-auth package) so Convex codegen and the component's
// function-handle dispatch resolve against this app's single
// @convex-dev/better-auth instance. With the package declaring that lib
// as a peerDependency, this is the one and only client the component
// talks to, so trigger callbacks actually fire in-transaction.
const authFunctions: AuthFunctions = (
  internal as unknown as { betterAuthClient: AuthFunctions }
).betterAuthClient;

// The package types its sync triggers loosely on purpose (the
// consumer's @convex-dev/better-auth instance may differ from the
// package's), so bridge the whole config to createClient's expected
// shape at the seam — the same deliberate cast pattern as authFunctions.
const clientConfig = {
  authFunctions,
  triggers: createBetterAuthUserSyncTriggers<DataModel>({
    betterAuthComponent: components.betterAuth,
    refs: {
      upsertUserFromBetterAuth: internal.users.upsertFromBetterAuth,
      provisionIdentityFromIdentity:
        components.vortexAuth.identity.provisionFromIdentity,
      deleteUserFromBetterAuth: internal.users.deleteFromBetterAuth,
    },
  }),
} as unknown as Parameters<typeof createClient<DataModel>>[1];

export const authComponent: ReturnType<typeof createClient<DataModel>> =
  createClient<DataModel>(components.betterAuth, clientConfig);

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
