/**
 * Eval-only: payment extraction from raw contract text.
 *
 * In production, extraction runs against a PDF in Convex storage.
 * For evals, we bypass PDF upload entirely and pass contract text directly —
 * same model, same prompt, same schema. This lets the scoring script run
 * against the full corpus without needing to seed 20 PDFs into storage.
 *
 * DEV ONLY — guarded by CLERK_SECRET_KEY sk_test_ prefix check.
 */

import { generateObject } from "ai";
import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { getModel } from "./model";
import {
  PaymentExtractionSchema,
  type PaymentExtractionResult,
} from "./tools/paymentExtractionSchema";

const PAYMENT_EXTRACTION_PROMPT = `You are analyzing a contract document for a document signing platform. Your job is to extract all payment-related terms and structure them into a payment configuration.

## What to Extract
- **Line items**: Individual charges, fees, services with descriptions and amounts
- **Currency**: The currency used (infer from symbols: $ → usd, € → eur, £ → gbp). Always lowercase: "usd", "eur", "gbp"
- **Payment type**: Whether it's a one-time payment, recurring subscription, installment plan, or deposit + balance
- **Due date terms**: When payment is due (upon receipt, net 30, etc.)
- **Late fees**: Any penalty clauses for late payment
- **Recurring details**: Billing interval if subscription-based
- **Installment details**: Number of payments if split into installments
- **Deposit details**: Deposit percentage and balance due timeline

## Amount Format
- All monetary amounts must be in **cents** (multiply dollars by 100)
- $5,000.00 = 500000 cents, $99.99 = 9999 cents, £45,000 = 4500000 cents
- If an amount is ambiguous, use the most likely interpretation

## Payment Type Rules (read carefully)
- **"one_time"**: Single payment for a fixed scope of work
- **"recurring"**: Repeating payments that continue indefinitely (subscriptions, retainers billed monthly/annually)
- **"installments"**: Fixed number of split payments (e.g. "3 equal monthly payments", "paid in 4 instalments")
- **"deposit_balance"**: An upfront deposit followed by a final balance — use this when the contract mentions "deposit", "retainer upon signing + balance", "X% now and Y% later", or "balance due before [event/delivery]"

## Late Fee Rules (critical)
- **ONLY populate lateFee if the contract explicitly states a penalty amount for late payment**
- If the contract says "no late fee", "no penalty", or simply does not mention late fees → **omit lateFee entirely** (do not include the field)
- lateFee.amount for percentage type = the percentage number (e.g. 1.5 for 1.5%), NOT cents
- lateFee.amount for fixed type = cents (e.g. 5000 for $50.00)

## Custom Due Date Rules
- If dueDateTerms is "custom", you MUST populate customDueDays with the exact number of days
- Example: "due within 45 days" → dueDateTerms: "custom", customDueDays: 45

## Other Guidelines
1. Extract ONLY what is explicitly stated or clearly implied
2. Default paymentType to "one_time" unless the document clearly describes another structure
3. Default dueDateTerms to "net_30" if not specified
4. Quantity defaults to 1 unless explicitly stated
5. Currency defaults to "usd" if no currency indicator found — always use lowercase ISO 4217

Extract all payment terms from the document.`;

export const extractPaymentFromText = internalAction({
  args: {
    contractText: v.string(),
  },
  handler: async (_ctx, { contractText }): Promise<PaymentExtractionResult> => {
    const { object } = await generateObject({
      model: getModel(),
      schema: PaymentExtractionSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${PAYMENT_EXTRACTION_PROMPT}\n\n---\n\n${contractText}`,
            },
          ],
        },
      ],
    });

    return object;
  },
});
