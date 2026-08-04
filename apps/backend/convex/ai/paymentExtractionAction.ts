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
All monetary amounts must be in cents (multiply by 100). Examples:
- $5,000 = 500000 cents
- £45,000 = 4500000 cents
- €18,000 = 1800000 cents (18000 × 100)
- €250,000 = 25000000 cents (250000 × 100)
Keep all digits — do not drop zeros.

## Payment Type Rules (read carefully)
- "one_time": Single payment for fixed scope of work
- "recurring": Repeating payments indefinitely (subscriptions, monthly retainers)
- "installments": Fixed number of split payments (e.g. "3 equal monthly payments")
- "deposit_balance": Upfront deposit + final balance — use when contract mentions "deposit", "X% now and Y% later", or "balance due before [event/delivery]"

## Late Fee Rules (critical)
- ONLY populate lateFee if the contract explicitly states a contractual penalty amount for late payment
- If contract says "no late fee", "no penalty", or doesn't mention late fees → omit lateFee entirely (do not include the field)
- Statutory/legal default interest (e.g. "§288 BGB", "statutory interest rate", "legal interest rate", "statutory default rate") is NOT a contractual late fee — omit lateFee
- "Fixed penalty of $X per month/week" or "penalty of $X for each calendar month" IS a contractual late fee → type: "fixed", amount: X in cents per period
- "No grace period" / "with no grace period" → gracePeriodDays: 0
- lateFee.amount for percentage = the percentage number (1.5 for 1.5%), NOT cents
- lateFee.amount for fixed = cents per occurrence ($75/week = 7500, €200/month = 20000)

## Due Date Term Mapping (use these exact enum values)
Map contract language to enum values as follows — do NOT use "custom" unless the days don't match any standard term:
- "due upon receipt", "due on receipt", "due immediately", "due within 5 business days", "payable upon execution", "invoiced upon execution", "payable upon signing", "due at signing", "upon execution of this Agreement", "upon signing of this Agreement" → "on_receipt"
- "net 15", "within 15 days", "within fifteen (15) days", "within fifteen days", "due within fifteen days", "15-day payment terms" → "net_15"
- "net 30", "within 30 days", "within thirty (30) days", "within thirty days", "due within thirty days", "30-day payment terms" → "net_30"
- "net 60", "within 60 days", "within sixty (60) days", "within sixty days", "due within sixty days", "60-day payment terms" → "net_60"
- "within 45 days", "within 90 days", any non-standard number of days → "custom" + customDueDays
- Specific calendar dates with NO relative days statement ("due April 1, 2026", "due on the first day of each month") → "custom" (omit customDueDays)
- Invoice-relative days statement ("invoice issued X days before due date", "invoice is due X days from issuance", "due every X days") → "custom" + customDueDays set to X (even if specific calendar dates are ALSO mentioned)
- "X days PRIOR TO event/deadline/date" is event-relative, NOT net_X → "custom" (omit customDueDays)
- For "deposit_balance" type: dueDateTerms refers to when the BALANCE is due, NOT the deposit; "within X days of completion/delivery/handover/milestone" uses the same net_X mapping as invoice-relative terms

CRITICAL: Identify the PRIMARY due date clause. Many contracts have a secondary grace period clause (e.g. "No late fee applies if paid within 10 business days"). IGNORE grace period language — use only the primary due date statement.
Example: "Invoice is due upon receipt. No late fee if paid within 10 business days." → PRIMARY is "due upon receipt" → "on_receipt". The 10-day clause is a grace period, NOT the due date.

## Custom Due Date Rules
- Only use "custom" when the number of days does NOT match 15, 30, or 60, OR when payments are due on specific calendar dates, OR when the due date is relative to an event rather than invoice issuance
- If dueDateTerms is "custom" and an explicit relative number of days is stated (e.g., "due 90 days from issuance", "due every 7 days"), populate customDueDays with that number
- If dueDateTerms is "custom" due to calendar dates or event-relative terms with no explicit day count, omit customDueDays

## customDueDate Field (ISO 8601 calendar date)
- ONLY populate when dueDateTerms is "custom" AND the contract states a specific calendar date (e.g., "due April 1, 2026", "due on the first of each month starting May 1, 2026")
- Format: "YYYY-MM-DD", e.g. "2026-04-01"
- For installment contracts with multiple calendar dates, use the FIRST payment date
- Do NOT populate for purely event-relative terms ("X days prior to the event", "within 30 days of completion") — these have no extractable fixed date
- Do NOT populate when only relative days are stated ("due within 90 days") — use customDueDays instead

## Line Item Rules
- Create one line item per distinct service, product, or deliverable with its own stated price
- If a contract has an installment PAYMENT SCHEDULE for a single service (e.g., "3 equal payments of $2,000 for design services"), create ONE line item for the total ($6,000), NOT one per installment
- If a contract has multiple distinct services with separate prices (e.g., "equipment: $250,000; installation: $18,000; maintenance: $12,000"), create one line item per service
- Only include line items with FIXED, STATED amounts in cents
- EXCLUDE variable or cost-plus items: "expenses reimbursed at cost", "invoiced separately at cost", "not to exceed $X at cost", "disbursements at cost", "procurement costs TBD" — omit these entirely, mention in notes if needed
- EXCLUDE separately-invoiced expense reimbursements even if a cap is stated (e.g., "travel expenses not to exceed $3,000, invoiced at cost") — the amount is variable

## installmentsConfig Rules
- If paymentType is "installments", you MUST include installmentsConfig with count and interval
- count = total number of installment payments
- interval = "week" or "month" based on payment frequency

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
          const delayMs =
            RETRY_CONFIG.initialDelayMs * RETRY_CONFIG.backoffBase ** attempt;
          console.warn(
            `[AI Pipeline] Payment extraction attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  },
});
