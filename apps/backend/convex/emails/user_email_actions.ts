/**
 * User Email Actions
 *
 * Handles sending welcome emails.
 * These are actions (not mutations) because they call external email service.
 */

import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { sendWelcome } from "../documents/email";

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
    args
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
