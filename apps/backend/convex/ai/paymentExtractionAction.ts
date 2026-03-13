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
import { PaymentExtractionSchema, type PaymentExtractionResult } from "./tools/paymentExtractionSchema";


const PAYMENT_EXTRACTION_PROMPT = `You are analyzing a PDF document for a document signing platform. Your job is to extract all payment-related terms and structure them into a payment configuration.

## What to Extract
- **Line items**: Individual charges, fees, services with descriptions and amounts
- **Currency**: The currency used (infer from symbols: $ → usd, € → eur, £ → gbp)
- **Payment type**: Whether it's a one-time payment, recurring subscription, installment plan, or deposit + balance
- **Due date terms**: When payment is due (upon receipt, net 30, etc.)
- **Late fees**: Any penalty clauses for late payment
- **Recurring details**: Billing interval if subscription-based
- **Installment details**: Number of payments if split into installments
- **Deposit details**: Deposit percentage and balance due timeline

## Amount Format
- All monetary amounts must be in **cents** (multiply dollars by 100)
- $5,000.00 = 500000 cents
- $99.99 = 9999 cents
- If an amount is ambiguous, use the most likely interpretation

## Guidelines
1. Extract ONLY what is explicitly stated or clearly implied in the document
2. Default to "one_time" payment type unless the document clearly describes recurring/installments/deposit
3. Default to "net_30" due date terms if not specified
4. If the document mentions multiple payment phases, use the appropriate payment type (installments or deposit_balance)
5. Quantity defaults to 1 unless explicitly stated otherwise
6. Currency defaults to "usd" if no currency indicator is found

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
