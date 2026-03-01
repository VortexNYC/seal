/**
 * Document Completion Workflows
 *
 * Replaces the monolithic `sendPostSignatureEmails` action with two durable
 * workflows where each step retries independently:
 *
 * 1. `postSignatureWorkflow` — triggered after every recipient completion
 * 2. `documentCompletionWorkflow` — triggered once when all recipients are done
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { workflow } from "./index";

/**
 * Workflow A: Post-Signature Processing
 *
 * Triggered every time a recipient completes their action (sign/approve).
 * Sends confirmation, handles sequential notifications, and conditionally
 * kicks off the full completion workflow.
 */
export const postSignatureWorkflow = workflow.define({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
  },
  handler: async (step, args): Promise<void> => {
    // Step 1: Send confirmation email to the signer
    await step.runAction(internal.workflows.document_completion_steps.sendSignerConfirmation, {
      recipientId: args.recipientId,
      documentId: args.documentId,
    });

    // Step 2: If sequential mode, notify the next group
    await step.runAction(internal.workflows.document_completion_steps.notifyNextSequentialGroup, {
      recipientId: args.recipientId,
      documentId: args.documentId,
    });

    // Step 3: Check if all recipients are complete
    const { allComplete } = await step.runQuery(
      internal.workflows.document_completion_steps.checkAllRecipientsComplete,
      { documentId: args.documentId },
    );

    if (!allComplete) return;

    // Step 4: Guard against duplicate completion triggers
    const { shouldComplete } = await step.runMutation(
      internal.workflows.document_completion_steps.triggerDocumentCompletion,
      { documentId: args.documentId },
    );

    if (!shouldComplete) return;

    // Step 5: Run the full completion chain as a nested workflow
    await step.runWorkflow(internal.workflows.document_completion.documentCompletionWorkflow, {
      documentId: args.documentId,
    });
  },
});

/**
 * Workflow B: Document Completion Chain
 *
 * Triggered once when all recipients have completed. Handles the critical
 * completion sequence: mark complete → generate certificate + send emails.
 */
export const documentCompletionWorkflow = workflow.define({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (step, args): Promise<void> => {
    // Step 1: Mark document as completed
    await step.runMutation(internal.documents.recipient_email_action.markDocumentAsCompleted, {
      documentId: args.documentId,
    });

    // Step 2: Generate certificate and send completion emails in parallel
    await Promise.all([
      step.runAction(internal.documents.certificate_of_completion.generateCertificate, {
        documentId: args.documentId,
      }),
      step.runAction(internal.workflows.document_completion_steps.sendCompletionEmails, {
        documentId: args.documentId,
      }),
    ]);
  },
});
