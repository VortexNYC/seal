/**
 * User Email Actions
 *
 * Handles sending welcome and team invitation emails.
 * These are actions (not mutations) because they call external email service.
 */

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { sendTeamInvitation, sendWelcome } from "../documents/email";

/**
 * Send welcome email to new user
 * Called after user is created via webhook
 */
export const sendWelcomeEmail = internalAction({
  args: {
    userEmail: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    const dashboardUrl = `${baseUrl}/dashboard`;

    const result = await sendWelcome(ctx, {
      to: args.userEmail,
      userName: args.userName || "there",
      dashboardUrl,
    });

    if (!result.success) {
      console.error("Failed to send welcome email:", result.error);
    } else {
      console.info(`Welcome email sent to ${args.userEmail}`);
    }

    return result;
  },
});

/**
 * Send team invitation email
 * Called after invitation is created via webhook
 */
export const sendTeamInvitationEmail = internalAction({
  args: {
    inviteeEmail: v.string(),
    inviterName: v.string(),
    inviterEmail: v.string(),
    organizationName: v.string(),
    role: v.string(),
    clerkInvitationId: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> => {
    // Build invite URL - Clerk handles the actual invitation acceptance
    // The URL should point to Clerk's invitation acceptance flow
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
    // Clerk invitation URLs are typically handled through their system
    // We'll create a redirect URL that works with Clerk
    const inviteUrl = `${baseUrl}/sign-in?redirect_url=/accept-invitation/${args.clerkInvitationId}`;

    const result = await sendTeamInvitation(ctx, {
      to: args.inviteeEmail,
      inviterName: args.inviterName,
      inviterEmail: args.inviterEmail,
      organizationName: args.organizationName,
      role: args.role,
      inviteUrl,
      expiresAt: args.expiresAt,
    });

    if (!result.success) {
      console.error("Failed to send team invitation email:", result.error);
    } else {
      console.info(
        `Team invitation email sent to ${args.inviteeEmail} for ${args.organizationName}`,
      );
    }

    return result;
  },
});
