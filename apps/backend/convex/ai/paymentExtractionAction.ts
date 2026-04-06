/**
 * Cacheable internal action for payment term extraction via Gemini.
 *
 * Separated from the agent tool so that @convex-dev/action-cache can
 * wrap it — the cache keys on (storageId) so the same PDF extracted
 * twice returns the cached result instantly.
 *
 * Includes retry logic with exponential backoff for transient failures.
 */

import { generateObject } from "ai";
import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { getModel } from "./model";
import {
  PaymentExtractionSchema,
  type PaymentExtractionResult,
} from "./tools/paymentExtractionSchema";

const PAYMENT_EXTRACTION_PROMPT = `You are analyzing a PDF document for a document signing platform. Extract all payment-related terms.

## Amount Format
All monetary amounts must be in cents (multiply by 100). $5,000 = 500000 cents, £45,000 = 4500000 cents.

## Payment Type Rules (read carefully)
- "one_time": Single payment for fixed scope of work
- "recurring": Repeating payments indefinitely (subscriptions, monthly retainers)
- "installments": Fixed number of split payments (e.g. "3 equal monthly payments")
- "deposit_balance": Upfront deposit + final balance — use when contract mentions "deposit", "X% now and Y% later", or "balance due before [event/delivery]"

## Late Fee Rules (critical)
- ONLY populate lateFee if the contract explicitly states a penalty amount for late payment
- If contract says "no late fee", "no penalty", or doesn't mention late fees → omit lateFee entirely (do not include the field)
- lateFee.amount for percentage = the percentage number (1.5 for 1.5%), NOT cents
- lateFee.amount for fixed = cents ($50 = 5000)

## Due Date Term Mapping (use these exact enum values)
Map contract language to enum values as follows — do NOT use "custom" unless the days don't match any standard term:
- "due upon receipt", "due on receipt", "due immediately", "due within 5 business days", "payable upon execution", "invoiced upon execution", "payable upon signing", "due at signing", "upon contract execution", "upon execution of this Agreement", "upon signing of this Agreement" → "on_receipt"
- "net 15", "within 15 days", "within fifteen (15) days", "within fifteen days", "due within fifteen days", "15-day payment terms" → "net_15"
- "net 30", "within 30 days", "within thirty (30) days", "within thirty days", "due within thirty days", "30-day payment terms" → "net_30"
- "net 60", "within 60 days", "within sixty (60) days", "within sixty days", "due within sixty days", "60-day payment terms" → "net_60"
- "within 45 days", "within 90 days", any non-standard number of days → "custom" + customDueDays

CRITICAL: Identify the PRIMARY due date clause. Many contracts have a secondary grace period clause (e.g. "No late fee applies if paid within 10 business days"). IGNORE grace period language — use only the primary due date statement.
Example: "Invoice is due upon receipt. No late fee if paid within 10 business days." → PRIMARY is "due upon receipt" → "on_receipt". The 10-day clause is a grace period, NOT the due date.

## Custom Due Date Rules
- Only use "custom" when the number of days does NOT match 15, 30, or 60
- If dueDateTerms is "custom", you MUST populate customDueDays with the exact number of days

## Line Item Rules
- Create one line item per distinct service, product, or deliverable with its own stated price
- If a contract has an installment PAYMENT SCHEDULE for a single service (e.g., "3 equal payments of $2,000 for design services"), create ONE line item for the total ($6,000), NOT one per installment
- If a contract has multiple distinct services with separate prices (e.g., "equipment: $250,000; installation: $18,000; maintenance: $12,000"), create one line item per service
- Only include line items with FIXED, STATED amounts in cents
- EXCLUDE variable or cost-plus items like "third-party costs invoiced at cost", "disbursements at cost", "procurement costs TBD" — omit these, mention in notes instead

## Other Guidelines
1. Extract ONLY what is explicitly stated
2. Default paymentType to "one_time" unless document clearly describes another structure
3. Default dueDateTerms to "net_30" if not specified
4. Currency always lowercase ISO 4217: "usd", "eur", "gbp". Default "usd" if no indicator
5. Quantity defaults to 1 unless explicitly stated

Extract all payment terms from the document.`;

// ---------------------------------------------------------------------------
// Retry config
// ---------------------------------------------------------------------------

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffBase: 2,
};

// ---------------------------------------------------------------------------
// Internal action (the expensive Gemini call)
// ---------------------------------------------------------------------------

export const extractPaymentInternal = internalAction({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<PaymentExtractionResult> => {
    const pdfUrl = await ctx.storage.getUrl(args.storageId);
    if (!pdfUrl) throw new Error("PDF not found in storage");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to download PDF");
    const pdfBuffer = await response.arrayBuffer();
    // Convex actions run in V8 isolate — Buffer is unavailable, use chunked btoa
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const pdfBase64 = btoa(binary);

    // Retry with exponential backoff for transient Gemini failures
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const result = await generateObject({
          model: getModel("google/gemini-3-flash"),
          schema: PaymentExtractionSchema,
          messages: [
            {
              role: "user",
              content: [
                { type: "file", data: pdfBase64, mediaType: "application/pdf" },
                { type: "text", text: PAYMENT_EXTRACTION_PROMPT },
              ],
            },
          ],
        });

        return PaymentExtractionSchema.parse(result.object);
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_CONFIG.maxRetries) {
          const delayMs = RETRY_CONFIG.initialDelayMs * RETRY_CONFIG.backoffBase ** attempt;
          console.warn(
            `[AI Pipeline] Payment extraction attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
            error,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  },
});
