/**
 * Organization invitations on the vortexAuth component.
 *
 * Invitation truth lives in the component; the raw token is shown once and
 * emailed, only its sha256 hash is stored. Acceptance materializes a
 * component membership.
 */
import { createOrganizationInvitationEmailDraft } from "@vortexnyc/auth/convex";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { authAction, getAuthContext } from "./auth";
import { sendAuthEmailDraft } from "./emails/worker_email";
import {
  getComponentInvitationById,
  getComponentInvitationByTokenHash,
  getComponentMemberRefForUserOrganization,
  listComponentInvitationsByOrganization,
} from "./lib/componentOrgReads";
import {
  createVortexAuthInvitation,
  setVortexAuthInvitationStatus,
  upsertVortexAuthMember,
} from "./lib/vortexAuthOrganizations";

const inviteRoleValidator = v.union(
  v.literal("admin"),
  v.literal("member"),
  v.literal("viewer")
);

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function appOrigin(): string {
  return process.env.SEAL_APP_ORIGIN || "https://app.seal.nyc";
}

export const createInvitationCore = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    invitedBy: v.id("users"),
    email: v.string(),
    role: inviteRoleValidator,
  },
  handler: async (
    ctx,
    args
  ): Promise<{ invitationId: string; acceptUrl: string; token: string }> => {
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new ConvexError("Invalid email address");
    }

    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const inviter = await ctx.db.get("users", args.invitedBy);
    if (!inviter) {
      throw new ConvexError("Inviter not found");
    }

    // Reject duplicate pending invitations for the same email.
    const existing = await listComponentInvitationsByOrganization(
      ctx,
      organization,
      "pending"
    );
    if (existing.some((inv) => inv.email.toLowerCase() === email)) {
      throw new ConvexError(
        "An invitation has already been sent to this email"
      );
    }

    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const expiresAt = Date.now() + INVITE_TTL_MS;

    const invitationId = await createVortexAuthInvitation(ctx, {
      organizationId: args.organizationId,
      email,
      tokenHash,
      role: args.role,
      status: "pending",
      invitedBy: args.invitedBy,
      expiresAt,
    });

    const acceptUrl = `${appOrigin()}/accept-invite?token=${token}`;

    // Send the invite email (scheduled action — render + Resend).
    await ctx.scheduler.runAfter(0, internal.invitations.sendInviteEmail, {
      to: email,
      acceptUrl,
      organizationName: organization.name,
      inviterLabel: inviter.name ?? inviter.email,
      roleName: args.role,
      expiresAt,
    });

    return { invitationId, acceptUrl, token };
  },
});

/**
 * Create an organization invitation in the component + email the invitee a
 * tokenized accept link. Requires the `org:users:invite` permission.
 */
export const createInvitation = authAction({
  args: {
    email: v.string(),
    role: inviteRoleValidator,
    expectedVortexAuthOrganizationId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ invitationId: string; acceptUrl: string; token: string }> => {
    if (
      !ctx.auth.permissions.includes("org:users:invite") &&
      !ctx.auth.permissions.includes("organization:invitations")
    ) {
      throw new ConvexError("You do not have permission to invite members");
    }

    // SEA-605: server-enforce seats (UI Pro gate is not enough). Pending
    // invites reserve a seat so Free cannot invite and Pro cannot overbook.
    await ctx.runAction(internal.auth.subscription_guards.ensureSeatLimitD1, {
      organizationId: ctx.auth.organizationId,
      includePendingInvites: true,
    });

    return await ctx.runMutation(internal.invitations.createInvitationCore, {
      organizationId: ctx.auth.organizationId,
      invitedBy: ctx.auth.userId,
      email: args.email,
      role: args.role,
    });
  },
});

/**
 * Internal: render the invitation email via the shipped draft builder (no
 * hand-rolled HTML) and send it through Seal's Resend component.
 */
export const sendInviteEmail = internalAction({
  args: {
    to: v.string(),
    acceptUrl: v.string(),
    organizationName: v.string(),
    inviterLabel: v.string(),
    roleName: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const from = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";
    const draft = await createOrganizationInvitationEmailDraft({
      from,
      to: args.to,
      acceptUrl: args.acceptUrl,
      organizationName: args.organizationName,
      roleName: args.roleName,
      inviterLabel: args.inviterLabel,
      expiresAt: args.expiresAt,
    });
    if ("status" in draft) {
      console.error(`[invite-email] not sent to ${args.to}: ${draft.reason}`);
      return;
    }
    await sendAuthEmailDraft(ctx, draft);
  },
});

/** List the organization's invitations (optionally by status) for the team UI. */
export const listInvitations = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revoked"),
        v.literal("expired")
      )
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const invitations = await listComponentInvitationsByOrganization(
      ctx,
      auth.organization,
      args.status
    );
    return invitations.map((inv) => ({
      id: inv._id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
    }));
  },
});

/** Revoke a pending invitation (org-scoped + permission-gated). */
export const revokeInvitation = mutation({
  args: { invitationId: v.string() },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasPermission("org:users:remove")) {
      throw new ConvexError("You do not have permission to revoke invitations");
    }
    const invitation = await getComponentInvitationById(ctx, args.invitationId);
    if (
      invitation === null ||
      invitation.organizationId !== auth.organizationId
    ) {
      throw new ConvexError("Invitation not found in this organization");
    }
    if (invitation.status !== "pending") {
      throw new ConvexError("Only pending invitations can be revoked");
    }
    await setVortexAuthInvitationStatus(ctx, {
      organizationId: auth.organizationId,
      invitationId: args.invitationId,
      status: "revoked",
    });
    return { success: true };
  },
});

/** Public: look up an invitation by its raw token (for the accept page). */
export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const tokenHash = await sha256(args.token);
    const invitation = await getComponentInvitationByTokenHash(ctx, tokenHash);
    if (invitation === null) {
      return null;
    }
    return {
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
    };
  },
});

export const redeemInvitationPreflight = internalQuery({
  args: {
    subject: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.subject))
      .first();
    if (user === null) {
      throw new ConvexError("User record not found");
    }

    const tokenHash = await sha256(args.token);
    const invitation = await getComponentInvitationByTokenHash(ctx, tokenHash);
    if (invitation === null) {
      throw new ConvexError("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new ConvexError(`Invitation is ${invitation.status}`);
    }
    if (invitation.expiresAt < Date.now()) {
      await setVortexAuthInvitationStatus(ctx, {
        organizationId: invitation.organizationId,
        invitationId: invitation._id,
        status: "expired",
      });
      throw new ConvexError("Invitation has expired");
    }

    const organization = await ctx.db.get(
      "organizations",
      invitation.organizationId
    );
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const existingMembership = await getComponentMemberRefForUserOrganization(
      ctx,
      user,
      organization
    );

    return {
      userId: user._id,
      invitationId: invitation._id,
      organizationId: organization._id,
      vortexAuthOrganizationId: organization.vortexAuthOrganizationId,
      existingMembership: existingMembership?._id ?? null,
    };
  },
});

export const redeemInvitationCore = internalMutation({
  args: {
    userId: v.id("users"),
    invitationId: v.string(),
    organizationId: v.id("organizations"),
    vortexAuthOrganizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new ConvexError("User record not found");
    }

    const invitation = await getComponentInvitationById(ctx, args.invitationId);
    if (invitation === null) {
      throw new ConvexError("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new ConvexError(`Invitation is ${invitation.status}`);
    }
    if (invitation.expiresAt < Date.now()) {
      await setVortexAuthInvitationStatus(ctx, {
        organizationId: args.organizationId,
        invitationId: invitation._id,
        status: "expired",
      });
      throw new ConvexError("Invitation has expired");
    }

    await upsertVortexAuthMember(ctx, {
      organizationId: args.organizationId,
      userId: args.userId,
      role: invitation.role,
      status: "active",
      invitedBy: invitation.invitedBy,
      acceptedAt: now,
    });
    await setVortexAuthInvitationStatus(ctx, {
      organizationId: args.organizationId,
      invitationId: invitation._id,
      status: "accepted",
      acceptedByUserId: args.userId,
      acceptedAt: now,
    });

    await ctx.db.patch("users", args.userId, {
      activeOrganizationId: args.organizationId,
      activeVortexAuthOrganizationId: args.vortexAuthOrganizationId,
      updatedAt: now,
    });

    return { organizationId: args.organizationId };
  },
});

/**
 * Redeem an invitation: the authenticated user joins the inviting org as the
 * invited role and it becomes their active org. Idempotent-ish (re-redeeming a
 * non-pending invite throws).
 */
export const redeemInvitation = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ organizationId: string }> => {
    const { subject } = await ctx.runQuery(
      internal.auth.wrappers.getViewerIdentity,
      {}
    );
    const preflight = await ctx.runQuery(
      internal.invitations.redeemInvitationPreflight,
      { subject, token: args.token }
    );

    // Already a member: allow redeem without consuming another seat.
    if (preflight.existingMembership === null) {
      await ctx.runAction(internal.auth.subscription_guards.ensureSeatLimitD1, {
        organizationId: preflight.organizationId,
      });
    }

    return await ctx.runMutation(internal.invitations.redeemInvitationCore, {
      userId: preflight.userId,
      invitationId: preflight.invitationId,
      organizationId: preflight.organizationId,
      vortexAuthOrganizationId: preflight.vortexAuthOrganizationId,
    });
  },
});
