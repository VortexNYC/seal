import { and, eq, isNotNull, lte } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documentInvoices, documents } from "../global/schema.js";
import { sendEmail, type EmailEnv } from "./email.js";

const DAY_MS = 86_400_000;

const DUNNING_DELAYS = [
  0, // Step 0: immediate
  3 * DAY_MS, // Step 1: 3 days after step 0
  7 * DAY_MS, // Step 2: 7 days after step 1
];

const MAX_DUNNING_STEP = DUNNING_DELAYS.length - 1;

const FROM_EMAIL = "Seal <no-reply@seal.nyc>";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amountCents: number, currency: string): string {
  const amount = (amountCents / 100).toFixed(2);
  return `${amount} ${currency.toUpperCase()}`;
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
  amount: string
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
  paymentUrl: string | null
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

export async function runDunningEmails(
  env: EmailEnv & { D1: D1Database }
): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();

  const due = await db
    .select({
      invoice: documentInvoices,
      documentName: documents.name,
    })
    .from(documentInvoices)
    .innerJoin(documents, eq(documents.id, documentInvoices.documentId))
    .where(
      and(
        eq(documentInvoices.dunningStatus, "active"),
        isNotNull(documentInvoices.nextDunningAt),
        lte(documentInvoices.nextDunningAt, now)
      )
    );

  await Promise.all(
    due.map(async ({ invoice, documentName }) => {
      const paidOrVoid =
        invoice.status === "paid" ||
        invoice.status === "void" ||
        invoice.status === "deleted";

      if (paidOrVoid) {
        await db
          .update(documentInvoices)
          .set({
            dunningStatus: "cancelled",
            dunningCompletedAt: now,
            nextDunningAt: null,
            updatedAt: now,
          })
          .where(eq(documentInvoices.id, invoice.id));
        return;
      }

      const step = invoice.dunningStep ?? 0;
      const customerName = invoice.customerName ?? invoice.customerEmail;
      const amount = formatCurrency(invoice.amountDue, invoice.currency);
      const content = getDunningEmailContent(
        step,
        documentName ?? "your document",
        amount
      );
      const html = renderDunningHtml(
        content,
        customerName,
        invoice.hostedInvoiceUrl
      );

      const result = await sendEmail(env, {
        from: FROM_EMAIL,
        to: invoice.customerEmail,
        subject: content.subject,
        html,
      });

      if (!result.success) {
        console.error("[scheduled/dunning] email failed:", {
          invoiceId: invoice.id,
          step,
          error: result.error,
        });
        return;
      }

      if (step >= MAX_DUNNING_STEP) {
        await db
          .update(documentInvoices)
          .set({
            dunningStatus: "completed",
            dunningStep: step,
            lastDunningEmailAt: now,
            nextDunningAt: null,
            dunningCompletedAt: now,
            updatedAt: now,
          })
          .where(eq(documentInvoices.id, invoice.id));
        return;
      }

      const nextStep = step + 1;
      const delay = DUNNING_DELAYS[nextStep];
      if (delay === undefined) {
        return;
      }
      const nextAt = new Date(now.getTime() + delay);
      await db
        .update(documentInvoices)
        .set({
          dunningStep: nextStep,
          lastDunningEmailAt: now,
          nextDunningAt: nextAt,
          updatedAt: now,
        })
        .where(eq(documentInvoices.id, invoice.id));
    })
  );
}
