/**
 * Rotate a COMPONENT api key secret. Kept separate from betterAuthOrganizations
 * so this cutover does not re-lint pre-existing bridge-id casts in that file.
 */
import { components } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

type BetterAuthMutationCtx = Pick<
  MutationCtx,
  "db" | "runMutation" | "runQuery"
>;

export async function rotateBetterAuthApiKey(
  ctx: BetterAuthMutationCtx,
  args: {
    apiKeyId: string;
    betterAuthOrganizationId: string;
    keyPrefix: string;
    keyHash: string;
  }
): Promise<void> {
  await ctx.runMutation(components.betterAuthConsumer.apiKeys.rotateApiKey, {
    apiKeyId: args.apiKeyId,
    organizationId: args.betterAuthOrganizationId,
    keyPrefix: args.keyPrefix,
    keyHash: args.keyHash,
  });
}
