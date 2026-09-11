import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  ensureBetterAuthOrganization,
  upsertBetterAuthMember,
} from "./lib/betterAuthOrganizations";
import type { OrganizationMemberRole } from "./schema";

type TestBetterAuthCtx = Pick<MutationCtx, "db" | "runMutation" | "runQuery">;
type ComponentMemberStatus = "active" | "invited" | "suspended";
const testBetterAuthIdentityIssuer = "seal-test-vortex-auth";

export async function seedTestOrganizationMember(
  ctx: TestBetterAuthCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    role: OrganizationMemberRole;
    status?: ComponentMemberStatus;
    identityIssuer?: string;
  }
): Promise<string> {
  let user = await ctx.db.get("users", args.userId);
  if (!user) {
    throw new Error(`test_user_not_found: ${args.userId}`);
  }

  if (!user.betterAuthUserId) {
    await ctx.runMutation(internal.users.upsertFromBetterAuth, {
      betterAuthUserId: user.authSubject,
      email: user.email,
      emailVerified: user.isEmailVerified,
      issuer: args.identityIssuer ?? testBetterAuthIdentityIssuer,
      ...(user.name !== undefined ? { name: user.name } : {}),
      ...(user.avatar !== undefined ? { image: user.avatar } : {}),
    });

    user = await ctx.db.get("users", args.userId);
    if (!user?.betterAuthUserId) {
      throw new Error(
        `test_user_better_auth_bridge_not_provisioned: ${args.userId}`
      );
    }
  }

  const betterAuthOrganizationId = await ensureBetterAuthOrganization(
    ctx,
    args.organizationId,
    user.betterAuthUserId
  );

  await ctx.db.patch("users", args.userId, {
    activeOrganizationId: args.organizationId,
    activeBetterAuthOrganizationId: betterAuthOrganizationId,
    updatedAt: Date.now(),
  });

  return await upsertBetterAuthMember(ctx, {
    betterAuthOrganizationId,
    betterAuthUserId: user.betterAuthUserId,
    role: args.role,
    status: args.status ?? "active",
  });
}
