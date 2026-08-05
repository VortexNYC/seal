/**
 * Rotate a COMPONENT api key secret. Kept separate from vortexAuthOrganizations
 * so this cutover does not re-lint pre-existing bridge-id casts in that file.
 */
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ensureVortexAuthOrganization } from "./vortexAuthOrganizations";

type VortexAuthMutationCtx = Pick<
  MutationCtx,
  "db" | "runMutation" | "runQuery"
>;

export async function rotateVortexAuthApiKey(
  ctx: VortexAuthMutationCtx,
  args: {
    apiKeyId: string;
    organizationId: Id<"organizations">;
    keyPrefix: string;
    keyHash: string;
  }
): Promise<void> {
  const organizationId = await ensureVortexAuthOrganization(
    ctx,
    args.organizationId
  );
  await ctx.runMutation(components.vortexAuth.apiKeys.rotateApiKey, {
    apiKeyId: args.apiKeyId,
    organizationId,
    keyPrefix: args.keyPrefix,
    keyHash: args.keyHash,
  });
}
