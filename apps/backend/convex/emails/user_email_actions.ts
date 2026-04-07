/**
 * User Email Actions
 *
 * Handles sending welcome and team invitation emails.
 * These are actions (not mutations) because they call external email service.
 */

import { v } from "convex/values";
import { Resend } from "resend";

import { internalAction } from "../_generated/server";
import { resendComponent } from "../emails/resend_component";
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5180";
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

function getResendSdk(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

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
    inviteUrl: v.optional(v.string()),
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
    const inviteUrl =
      args.inviteUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5180"}/accept-invite`;

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

/**
 * Send waitlist status notification to internal sales
 */
export const sendWaitlistNotificationEmail = internalAction({
  args: {
    emailAddress: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("invited"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
    waitlistEntryId: v.string(),
    inviteUrl: v.optional(v.string()),
    invitationStatus: v.optional(v.string()),
    invitationCreatedAt: v.optional(v.number()),
    invitationUpdatedAt: v.optional(v.number()),
    updatedAt: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> => {
    const to = process.env.WAITLIST_NOTIFICATION_EMAIL || "sales@seal.co";
    const from = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";
    const statusLabel = args.status === "invited" ? "approved" : args.status;
    const subject = `Seal waitlist ${statusLabel}: ${args.emailAddress}`;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">Waitlist update</h1>
        <p style="margin: 0 0 12px;">${args.emailAddress} is now <strong>${args.status}</strong>.</p>
        <ul style="margin: 0 0 12px; padding-left: 20px;">
          <li>Waitlist entry ID: ${args.waitlistEntryId}</li>
          <li>Invitation status: ${args.invitationStatus || "n/a"}</li>
          <li>Invitation created at: ${args.invitationCreatedAt ? new Date(args.invitationCreatedAt).toISOString() : "n/a"}</li>
          <li>Invitation updated at: ${args.invitationUpdatedAt ? new Date(args.invitationUpdatedAt).toISOString() : "n/a"}</li>
          <li>Waitlist updated at: ${new Date(args.updatedAt).toISOString()}</li>
          <li>Invite URL: ${args.inviteUrl || "n/a"}</li>
        </ul>
      </div>
    `;

    const emailId = await resendComponent.sendEmailManually(
      ctx,
      { from, to: [to], subject },
      async (idempotencyKey: string) => {
        const resend = getResendSdk();
        const { data, error } = await resend.emails.send({
          from,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message);
        return data!.id;
      },
    );

    return { success: true, messageId: emailId };
  },
});
