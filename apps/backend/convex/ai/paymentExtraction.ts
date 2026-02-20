/**
 * Payment term extraction action.
 *
 * Scheduled by `applyFieldSuggestions` when payment fields are applied.
 * Downloads the PDF, sends it to Gemini for payment-specific analysis,
 * and creates payment_field_configs records for each payment field.
 */

import { generateObject } from "ai";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { getModel } from "./model";
import { PaymentExtractionSchema } from "./tools/extract_payment_terms";

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

export const extractPaymentTermsForFields = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    paymentFieldIds: v.array(v.id("signature_fields")),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });
    if (!document) throw new Error("Document not found");

    // Download PDF
    const pdfUrl = await ctx.storage.getUrl(document.storageId as Id<"_storage">);
    if (!pdfUrl) throw new Error("PDF not found in storage");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to download PDF");
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    // Extract payment terms via Gemini
    const result = await generateObject({
      model: getModel("google/gemini-3-flash"),
      schema: PaymentExtractionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PAYMENT_EXTRACTION_PROMPT },
            { type: "file", data: pdfBase64, mediaType: "application/pdf" },
          ],
        },
      ],
    });

    const extracted = PaymentExtractionSchema.parse(result.object);

    // Save payment config for each payment field
    // (typically there's one payment field, but handle multiple)
    for (const fieldId of args.paymentFieldIds) {
      await ctx.runMutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId,
        documentId: args.documentId,
        organizationId: args.organizationId,
        extraction: {
          lineItems: extracted.lineItems,
          currency: extracted.currency,
          paymentType: extracted.paymentType,
          dueDateTerms: extracted.dueDateTerms,
          customDueDays: extracted.customDueDays,
          lateFee: extracted.lateFee,
          recurringConfig: extracted.recurringConfig,
          installmentsConfig: extracted.installmentsConfig,
          depositBalanceConfig: extracted.depositBalanceConfig,
        },
      });
    }
  },
});
