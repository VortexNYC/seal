/**
 * Document Cancellation Workflow
 *
 * Wraps the existing `sendCancellationEmails` action in a durable workflow
 * so transient failures (Resend API hiccup) are automatically retried.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { workflow } from "./index";

export const documentCancellationWorkflow = workflow.define({
  args: {
    documentId: v.id("documents"),
    reason: v.optional(v.string()),
  },
  handler: async (step, args): Promise<void> => {
    await step.runAction(
      internal.documents.cancellation_email_action.sendCancellationEmails,
      {
        documentId: args.documentId,
        reason: args.reason,
      }
    );
  },
});
