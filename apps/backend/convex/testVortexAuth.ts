import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { upsertVortexAuthMember } from "./lib/vortexAuthOrganizations";
import type { OrganizationMemberRole } from "./schema";

type TestVortexAuthCtx = Pick<MutationCtx, "db" | "runMutation">;
type ComponentMemberStatus = "active" | "invited" | "suspended";

export async function seedTestOrganizationMember(
  ctx: TestVortexAuthCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    role: OrganizationMemberRole;
    status?: ComponentMemberStatus;
  },
): Promise<string> {
  const user = await ctx.db.get(args.userId);
  if (!user) {
    throw new Error(`test_user_not_found: ${args.userId}`);
  }

  if (!user.vortexAuthUserId) {
    await ctx.db.patch(args.userId, {
      vortexAuthUserId: args.userId,
      updatedAt: Date.now(),
    });
  }

  return await upsertVortexAuthMember(ctx, {
    organizationId: args.organizationId,
    userId: args.userId,
    role: args.role,
    status: args.status ?? "active",
  });
}
