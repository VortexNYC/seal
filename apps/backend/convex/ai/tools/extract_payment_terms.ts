import { createTool } from "@convex-dev/agent";
import { z } from "zod";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { SealAICtx } from "../types";

// ---------------------------------------------------------------------------
// Zod schema for AI-extracted payment data
// ---------------------------------------------------------------------------

export const PaymentExtractionSchema = z.object({
  lineItems: z
    .array(
      z.object({
        description: z
          .string()
          .describe("Description of the line item, e.g. 'Monthly consulting fee'"),
        quantity: z.number().positive().describe("Quantity (default 1 if not specified)"),
        unitPriceCents: z
          .number()
          .int()
          .positive()
          .describe("Unit price in cents, e.g. 500000 for $5,000.00"),
      }),
    )
    .describe("Extracted line items from the document"),
  currency: z
    .string()
    .length(3)
    .describe(
      "ISO 4217 currency code, e.g. 'usd', 'eur', 'gbp'. Infer from $ → usd, € → eur, £ → gbp",
    ),
  paymentType: z
    .enum(["one_time", "recurring", "installments", "deposit_balance"])
    .describe(
      "Payment structure: one_time for single payments, recurring for subscriptions, installments for split payments, deposit_balance for upfront deposit + later balance",
    ),
  dueDateTerms: z
    .enum(["on_receipt", "net_15", "net_30", "net_60", "custom"])
    .describe("Payment due terms. Infer from 'due upon receipt', 'net 30', etc."),
  customDueDays: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Custom due days if dueDateTerms is 'custom'"),
  lateFee: z
    .object({
      type: z.enum(["percentage", "fixed"]),
      amount: z
        .number()
        .positive()
        .describe("Late fee amount — percentage (e.g. 2 for 2%) or fixed cents"),
      gracePeriodDays: z
        .number()
        .int()
        .nonnegative()
        .describe("Grace period in days before late fee applies"),
    })
    .optional()
    .describe("Late fee terms if mentioned in the document"),
  recurringConfig: z
    .object({
      interval: z.enum(["week", "month", "year"]),
      intervalCount: z.number().int().positive().describe("e.g. 1 for monthly, 2 for bi-monthly"),
    })
    .optional()
    .describe("Recurring/subscription config if paymentType is 'recurring'"),
  installmentsConfig: z
    .object({
      count: z.number().int().min(2).describe("Number of installment payments"),
      interval: z.enum(["week", "month"]),
    })
    .optional()
    .describe("Installment config if paymentType is 'installments'"),
  depositBalanceConfig: z
    .object({
      depositPercent: z.number().min(1).max(99).describe("Deposit percentage, e.g. 50 for 50%"),
      balanceDueDays: z
        .number()
        .int()
        .positive()
        .describe("Days after signing when balance is due"),
    })
    .optional()
    .describe("Deposit/balance config if paymentType is 'deposit_balance'"),
  notes: z
    .string()
    .optional()
    .describe("Any additional payment context from the document that doesn't fit above fields"),
});

export type PaymentExtractionResult = z.infer<typeof PaymentExtractionSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

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
// Tool
// ---------------------------------------------------------------------------

export const extractPaymentTerms = createTool({
  description:
    "Extract payment terms, line items, amounts, and billing structure from a document to auto-configure a payment field",
  args: z.object({
    documentId: z.string().describe("The Convex document ID"),
    fieldId: z.string().describe("The payment field ID to configure"),
  }),
  handler: async (ctx: SealAICtx, args): Promise<string> => {
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId as Id<"documents">,
    });
    if (!document) throw new Error("Document not found");

    // Use the cached PDF analysis to get the PDF content — avoids re-downloading
    // The Gemini call for payment extraction is separate from field detection
    const { generateObject } = await import("ai");
    const { getModel } = await import("../model");

    const pdfUrl = await ctx.storage.getUrl(document.storageId as Id<"_storage">);
    if (!pdfUrl) throw new Error("PDF not found in storage");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to download PDF");
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

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

    const extracted = PaymentExtractionSchema.parse(result.object);

    // Save the extracted payment config
    await ctx.runMutation(internal.ai.mutations.saveExtractedPaymentConfig, {
      fieldId: args.fieldId as Id<"signature_fields">,
      documentId: args.documentId as Id<"documents">,
      organizationId: ctx.organizationId,
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

    const totalCents = extracted.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0,
    );
    const totalFormatted = `$${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    return `Extracted payment config: ${extracted.lineItems.length} line item(s), ${totalFormatted} ${extracted.currency.toUpperCase()}, ${extracted.paymentType.replace("_", " ")} payment, due ${extracted.dueDateTerms.replace("_", " ")}.`;
  },
});
