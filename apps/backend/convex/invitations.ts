/**
 * Organization invitations on the vortexAuth component.
 *
 * Invitation truth lives in the component; the raw token is shown once and
 * emailed, only its sha256 hash is stored. Acceptance materializes a
 * component membership.
 */
import { createOrganizationInvitationEmailDraft } from "@plasmapos/auth/convex";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalAction,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getAuthContext } from "./auth";
import { sendEmailFromAction } from "./emails/resend_component";
import {
  getComponentInvitationByTokenHash,
  listComponentInvitationsByOrganization,
} from "./lib/componentOrgReads";
import {
  createVortexAuthInvitation,
  setVortexAuthInvitationStatus,
  upsertVortexAuthMember,
} from "./lib/vortexAuthOrganizations";

const inviteRoleValidator = v.union(v.literal("admin"), v.literal("member"), v.literal("viewer"));

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

/**
 * Create an organization invitation in the component + email the invitee a
 * tokenized accept link. Requires the `org:users:invite` permission.
 */
export const createInvitation = mutation({
  args: {
    email: v.string(),
    role: inviteRoleValidator,
  },
  handler: async (ctx, args): Promise<{ invitationId: string; acceptUrl: string }> => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasPermission("org:users:invite")) {
      throw new ConvexError("You do not have permission to invite members");
    }
    const email = args.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new ConvexError("Invalid email address");
    }

    // Reject duplicate pending invitations for the same email.
    const existing = await listComponentInvitationsByOrganization(
      ctx,
      auth.organization,
      "pending",
    );
    if (existing.some((inv) => inv.email.toLowerCase() === email)) {
      throw new ConvexError("An invitation has already been sent to this email");
    }

    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const expiresAt = Date.now() + INVITE_TTL_MS;

    const invitationId = await createVortexAuthInvitation(ctx, {
      organizationId: auth.organization._id,
      email,
      tokenHash,
      role: args.role,
      status: "pending",
      invitedBy: auth.user._id,
      expiresAt,
    });

    const acceptUrl = `${appOrigin()}/accept-invite?token=${token}`;

    // Send the invite email (scheduled action — render + Resend).
    await ctx.scheduler.runAfter(0, internal.invitations.sendInviteEmail, {
      to: email,
      acceptUrl,
      organizationName: auth.organization.name,
      inviterLabel: auth.user.name ?? auth.user.email,
      roleName: args.role,
      expiresAt,
    });

    return { invitationId, acceptUrl };
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
    const draft = createOrganizationInvitationEmailDraft({
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
    await sendEmailFromAction(ctx, draft);
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
        v.literal("expired"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const auth = await getAuthContext(ctx);
    const invitations = await listComponentInvitationsByOrganization(
      ctx,
      auth.organization,
      args.status,
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
    const invitations = await listComponentInvitationsByOrganization(ctx, auth.organization);
    if (!invitations.some((inv) => inv._id === args.invitationId)) {
      throw new ConvexError("Invitation not found in this organization");
    }
    await setVortexAuthInvitationStatus(ctx, {
      organizationId: auth.organization._id,
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

/**
 * Redeem an invitation: the authenticated user joins the inviting org as the
 * invited role and it becomes their active org. Idempotent-ish (re-redeeming a
 * non-pending invite throws).
 */
export const redeemInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx: MutationCtx, args): Promise<{ organizationId: string }> => {
    // The invitee is authenticated but typically has NO org yet, so resolve
    // the user directly (getAuthContext would require an active org).
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("Authentication required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
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

    const now = Date.now();
    await upsertVortexAuthMember(ctx, {
      organizationId: invitation.organizationId,
      userId: user._id,
      role: invitation.role,
      status: "active",
      invitedBy: invitation.invitedBy,
      acceptedAt: now,
    });
    await setVortexAuthInvitationStatus(ctx, {
      organizationId: invitation.organizationId,
      invitationId: invitation._id,
      status: "accepted",
      acceptedByUserId: user._id,
      acceptedAt: now,
    });

    // Make the joined org the user's active org so they land in it.
    const anchor = await ctx.db.get(invitation.organizationId);
    if (anchor) {
      await ctx.db.patch(user._id, {
        activeOrganizationId: invitation.organizationId,
        activeVortexAuthOrganizationId: anchor.vortexAuthOrganizationId,
        updatedAt: now,
      });
    }

    return { organizationId: invitation.organizationId };
  },
});
