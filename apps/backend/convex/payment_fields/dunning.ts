/**
 * Dunning (Payment Recovery) System
 *
 * 3-email overdue sequence triggered by failed payments:
 *   Step 0: Immediately on failure → "Payment failed" email
 *   Step 1: 3 days later → "Payment overdue" reminder
 *   Step 2: 7 days after step 1 → "Final notice"
 *
 * Cancelled automatically when invoice is paid, voided, or deleted.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Delays between dunning steps (in ms) */
const DUNNING_DELAYS = [
  0, // Step 0: immediate
  3 * DAY_MS, // Step 1: 3 days after step 0
  7 * DAY_MS, // Step 2: 7 days after step 1
];

const MAX_DUNNING_STEP = DUNNING_DELAYS.length - 1;

/**
 * Start dunning sequence for a failed invoice.
 * Called from updatePaymentStatusFromProviderInvoice when status becomes "failed".
 * Idempotent — won't restart if already active.
 */
export const startDunning = internalMutation({
  args: {
    invoiceId: v.id("document_invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    // Don't start if already active, completed, or cancelled
    if (
      invoice.dunningStatus === "active" ||
      invoice.dunningStatus === "completed" ||
      invoice.dunningStatus === "cancelled"
    ) {
      return null;
    }

    // Only dun open or uncollectible invoices
    if (invoice.status !== "open" && invoice.status !== "uncollectible")
      return null;

    const now = Date.now();

    await ctx.db.patch(args.invoiceId, {
      dunningStatus: "active",
      dunningStep: 0,
      dunningStartedAt: now,
      nextDunningAt: now, // Due immediately — picked up by cron or webhook handler
      updatedAt: now,
    });

    return { started: true, invoiceId: args.invoiceId };
  },
});

/**
 * Cancel dunning sequence.
 * Called when invoice is paid, voided, or deleted.
 */
export const cancelDunning = internalMutation({
  args: {
    invoiceId: v.id("document_invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return;

    if (invoice.dunningStatus !== "active") return;

    await ctx.db.patch(args.invoiceId, {
      dunningStatus: "cancelled",
      dunningCompletedAt: Date.now(),
      nextDunningAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Advance dunning to the next step after an email is sent.
 * Called by the email action after successful delivery.
 */
export const advanceDunningStep = internalMutation({
  args: {
    invoiceId: v.id("document_invoices"),
    completedStep: v.number(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return;

    if (invoice.dunningStatus !== "active") return;
    if (invoice.dunningStep !== args.completedStep) return;

    const now = Date.now();

    if (args.completedStep >= MAX_DUNNING_STEP) {
      // Final step completed — dunning sequence is done
      await ctx.db.patch(args.invoiceId, {
        dunningStatus: "completed",
        dunningStep: args.completedStep,
        lastDunningEmailAt: now,
        nextDunningAt: undefined,
        dunningCompletedAt: now,
        updatedAt: now,
      });
      return;
    }

    // Schedule next step
    const nextStep = args.completedStep + 1;
    const nextAt = now + sealAssertPresent(DUNNING_DELAYS[nextStep]);

    await ctx.db.patch(args.invoiceId, {
      dunningStep: nextStep,
      lastDunningEmailAt: now,
      nextDunningAt: nextAt,
      updatedAt: now,
    });
  },
});

/**
 * Daily cron: process dunning emails that are due.
 * Finds invoices with active dunning where nextDunningAt <= now.
 */
export const processDunningEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let emailsScheduled = 0;

    // Find all invoices with active dunning
    const activeInvoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_dunning_status", (q) => q.eq("dunningStatus", "active"))
      .collect();

    for (const invoice of activeInvoices) {
      // Skip if not yet due
      if (!invoice.nextDunningAt || invoice.nextDunningAt > now) continue;

      // Skip if invoice was paid/voided in the meantime
      if (invoice.status === "paid" || invoice.status === "void") {
        await ctx.db.patch(invoice._id, {
          dunningStatus: "cancelled",
          dunningCompletedAt: now,
          nextDunningAt: undefined,
          updatedAt: now,
        });
        continue;
      }

      const step = invoice.dunningStep ?? 0;

      // Schedule the email
      await ctx.scheduler.runAfter(
        0,
        internal.payment_fields.dunning_email_action.sendDunningEmail,
        { invoiceId: invoice._id, step }
      );

      emailsScheduled++;
    }

    return { emailsScheduled };
  },
});
