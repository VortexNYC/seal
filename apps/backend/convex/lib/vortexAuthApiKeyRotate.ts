/**
 * Rotate a COMPONENT api key secret. Kept separate from vortexAuthOrganizations
 * so this cutover does not re-lint pre-existing bridge-id casts in that file.
 */
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

type VortexAuthMutationCtx = Pick<
  MutationCtx,
  "db" | "runMutation" | "runQuery"
>;

export async function rotateVortexAuthApiKey(
  ctx: VortexAuthMutationCtx,
  args: {
    apiKeyId: string;
    vortexAuthOrganizationId: string;
    keyPrefix: string;
    keyHash: string;
  }
): Promise<void> {
  await ctx.runMutation(components.vortexAuth.apiKeys.rotateApiKey, {
    apiKeyId: args.apiKeyId,
    organizationId: args.vortexAuthOrganizationId,
    keyPrefix: args.keyPrefix,
    keyHash: args.keyHash,
  });
}
