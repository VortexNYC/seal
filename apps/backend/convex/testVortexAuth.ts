import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { upsertVortexAuthMember } from "./lib/vortexAuthOrganizations";
import type { OrganizationMemberRole } from "./schema";

type TestVortexAuthCtx = Pick<MutationCtx, "db" | "runMutation">;
type ComponentMemberStatus = "active" | "invited" | "suspended";
const testVortexAuthIdentityIssuer = "seal-test-vortex-auth";

export async function seedTestOrganizationMember(
  ctx: TestVortexAuthCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    role: OrganizationMemberRole;
    status?: ComponentMemberStatus;
    identityIssuer?: string;
  },
): Promise<string> {
  const user = await ctx.db.get(args.userId);
  if (!user) {
    throw new Error(`test_user_not_found: ${args.userId}`);
  }

  if (!user.vortexAuthUserId) {
    await ctx.runMutation(internal.users.upsertFromBetterAuth, {
      betterAuthUserId: user.authSubject,
      email: user.email,
      emailVerified: user.isEmailVerified,
      issuer: args.identityIssuer ?? testVortexAuthIdentityIssuer,
      ...(user.name !== undefined ? { name: user.name } : {}),
      ...(user.avatar !== undefined ? { image: user.avatar } : {}),
    });

    const bridgedUser = await ctx.db.get(args.userId);
    if (!bridgedUser?.vortexAuthUserId) {
      throw new Error(`test_user_vortex_auth_bridge_not_provisioned: ${args.userId}`);
    }
  }

  return await upsertVortexAuthMember(ctx, {
    organizationId: args.organizationId,
    userId: args.userId,
    role: args.role,
    status: args.status ?? "active",
  });
}
