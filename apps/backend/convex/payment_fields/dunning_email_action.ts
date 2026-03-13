/**
 * Dunning Email Action
 *
 * Sends payment recovery emails at each step of the dunning sequence.
 * Uses the hosted invoice URL so recipients can pay directly via Stripe.
 */

import { v } from "convex/values";
import { Resend } from "resend";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalQuery } from "../_generated/server";
import { resendComponent } from "../emails/resend_component";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";

function getResendSdk(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

interface DunningEmailContent {
  subject: string;
  heading: string;
  message: string;
  urgency: "low" | "medium" | "high";
}

function getDunningEmailContent(
  step: number,
  documentName: string,
  amount: string,
): DunningEmailContent {
  switch (step) {
    case 0:
      return {
        subject: `Payment failed for "${documentName}"`,
        heading: "Payment Failed",
        message: `We were unable to process your payment of ${amount} for "${documentName}". Please update your payment method and try again.`,
        urgency: "low",
      };
    case 1:
      return {
        subject: `Payment overdue: "${documentName}"`,
        heading: "Payment Overdue",
        message: `Your payment of ${amount} for "${documentName}" is overdue. Please complete your payment to avoid further action.`,
        urgency: "medium",
      };
    case 2:
      return {
        subject: `Final notice: Payment required for "${documentName}"`,
        heading: "Final Notice",
        message: `This is a final reminder that your payment of ${amount} for "${documentName}" remains outstanding. Please pay immediately to resolve this matter.`,
        urgency: "high",
      };
    default:
      return {
        subject: `Payment reminder: "${documentName}"`,
        heading: "Payment Reminder",
        message: `Your payment of ${amount} for "${documentName}" is outstanding.`,
        urgency: "medium",
      };
  }
}

function renderDunningHtml(
  content: DunningEmailContent,
  customerName: string,
  paymentUrl: string | undefined,
): string {
  const urgencyColor =
    content.urgency === "high"
      ? "#dc2626"
      : content.urgency === "medium"
        ? "#d97706"
        : "#6b7280";

  const buttonHtml = paymentUrl
    ? `<p style="margin: 24px 0;"><a href="${paymentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #A63D2F; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">Pay Now</a></p>`
    : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p style="color: ${urgencyColor}; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${escapeHtml(content.heading)}</p>
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>${escapeHtml(content.message)}</p>
      ${buttonHtml}
      <p style="color: #6b7280; font-size: 14px;">If you've already made this payment, please disregard this message.</p>
      <br/>
      <p style="color: #9ca3af; font-size: 12px;">— Seal</p>
    </div>
  `;
}

export const getInvoiceById = internalQuery({
  args: { invoiceId: v.id("document_invoices") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const getDocumentById = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

/**
 * Send a dunning email for a specific step.
 * After successful send, advances the dunning sequence.
 */
export const sendDunningEmail = internalAction({
  args: {
    invoiceId: v.id("document_invoices"),
    step: v.number(),
  },
  handler: async (ctx, args) => {
    const invoice: Doc<"document_invoices"> | null = await ctx.runQuery(
      internal.payment_fields.dunning_email_action.getInvoiceById,
      { invoiceId: args.invoiceId },
    );

    if (!invoice) return { success: false, error: "Invoice not found" };

    // Bail if dunning was cancelled or invoice was paid
    if (invoice.dunningStatus !== "active") {
      return { success: true }; // Not an error, just no longer needed
    }

    // Bail if this step is stale (invoice already advanced past it)
    if (invoice.dunningStep !== args.step) {
      return { success: true }; // Already advanced, skip duplicate
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      // Cancel dunning since invoice is resolved
      await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
        invoiceId: args.invoiceId,
      });
      return { success: true };
    }

    // Get document name for email
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.payment_fields.dunning_email_action.getDocumentById,
      { documentId: invoice.documentId },
    );

    const documentName = document?.name || "your document";
    const customerName = invoice.customerName || invoice.customerEmail;
    const amount = formatCurrency(invoice.amountDue, invoice.currency);

    const content = getDunningEmailContent(args.step, documentName, amount);
    const html = renderDunningHtml(content, customerName, invoice.hostedInvoiceUrl);

    try {
      await resendComponent.sendEmailManually(
        ctx,
        { from: FROM_EMAIL, to: [invoice.customerEmail], subject: content.subject },
        async (idempotencyKey: string) => {
          const resendSdk = getResendSdk();
          const { data, error } = await resendSdk.emails.send({
            from: FROM_EMAIL,
            to: [invoice.customerEmail],
            subject: content.subject,
            html,
            headers: { "Idempotency-Key": idempotencyKey },
          });
          if (error) throw new Error(error.message);
          return data!.id;
        },
      );

      // Advance to next step
      await ctx.runMutation(internal.payment_fields.dunning.advanceDunningStep, {
        invoiceId: args.invoiceId,
        completedStep: args.step,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to send dunning email", {
        invoiceId: args.invoiceId,
        step: args.step,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
