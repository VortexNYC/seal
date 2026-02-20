/**
 * Payment term extraction for the AI pipeline.
 *
 * Called by the pipeline after field analysis detects payment-type fields.
 * Extracts structured payment data from the PDF and stores it on the
 * suggestion row so it's ready when the user applies the suggestion.
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

/**
 * Extract payment terms from a PDF and store on the suggestion row.
 *
 * Called by pipeline.processDocument when field analysis finds payment fields.
 */
export const extractPaymentTermsForSuggestion = internalAction({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    suggestionId: v.id("ai_field_suggestions"),
    userId: v.optional(v.id("users")),
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
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const pdfBase64 = btoa(binary);

    // Extract payment terms via Gemini
    const startTime = Date.now();
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
    const durationMs = Date.now() - startTime;
    const tokensUsed = result.usage?.totalTokens ?? 0;

    const extracted = PaymentExtractionSchema.parse(result.object);

    // Log payment extraction usage
    if (args.userId && tokensUsed > 0) {
      try {
        await ctx.runMutation(internal.ai.usage.logAiUsage, {
          organizationId: args.organizationId,
          userId: args.userId,
          action: "payment_extraction" as const,
          tokensUsed,
          durationMs,
          documentId: args.documentId,
          modelUsed: "gemini-3-flash",
        });
      } catch (usageError) {
        console.error("[Payment Extraction] Failed to log usage:", usageError);
      }
    }

    // Store extracted payment data on the suggestion row
    await ctx.runMutation(internal.ai.pipeline_mutations.savePaymentExtractionOnSuggestion, {
      suggestionId: args.suggestionId,
      paymentExtraction: {
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

    return {
      lineItemCount: extracted.lineItems.length,
      totalCents: extracted.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      ),
      currency: extracted.currency,
      paymentType: extracted.paymentType,
    };
  },
});
