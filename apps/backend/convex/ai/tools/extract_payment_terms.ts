import { ActionCache } from "@convex-dev/action-cache";
import { createTool } from "@convex-dev/agent";
import { parse } from "@vortexnyc/convex/helpers";
import { formatMoney, money } from "@vortexnyc/money";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";

import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { toActionCacheCtx } from "../component_ctx";
import type { SealAICtx } from "../types";

// Re-export schema from standalone module (keeps imports stable for consumers
// while letting tests import without side effects).
export {
  PaymentExtractionSchema,
  type PaymentExtractionResult,
} from "./paymentExtractionSchema";

import type { PaymentExtractionResult } from "./paymentExtractionSchema";

// ---------------------------------------------------------------------------
// Cacheable internal action — keyed on storageId so same PDF = same result
// ---------------------------------------------------------------------------

// Note: This is referenced by the ActionCache below. The actual Convex function
// is registered via the internalAction export in the payment extraction action file.
// We import it dynamically to avoid circular deps.

type PaymentCacheAction = FunctionReference<
  "action",
  "internal",
  { storageId: Id<"_storage"> },
  PaymentExtractionResult
>;

/** Cache for payment extraction — keyed on storageId, 24-hour TTL.
 *  Same PDF analyzed for payment terms twice returns cached result. */
export const paymentExtractionCache: ActionCache<PaymentCacheAction> =
  new ActionCache(components.actionCache, {
    action: internal.ai.paymentExtractionAction.extractPaymentInternal,
    name: "paymentExtraction-v1",
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export const extractPaymentTerms = createTool({
  description:
    "Extract payment terms, line items, amounts, and billing structure from a document to auto-configure a payment field",
  inputSchema: z.object({
    documentId: z
      .string()
      .optional()
      .describe("The Convex document ID (uses current document if omitted)"),
    fieldId: z.string().describe("The payment field ID to configure"),
  }),
  execute: async (ctx: SealAICtx, args): Promise<string> => {
    try {
      const rawDocId = args.documentId ?? ctx.documentId;
      if (!rawDocId)
        throw new Error(
          "No document ID provided and no current document context"
        );
      const docId = parse(v.id("documents"), rawDocId);

      // Rate limit expensive Gemini extraction call (20 ops/min per org)
      await ctx.runMutation(
        internal.ai.rateLimiting.checkExpensiveOperationLimit,
        {
          organizationId: ctx.organizationId.toString(),
        }
      );

      const document = await ctx.runQuery(
        internal.documents.document_reads.getDocumentInternal,
        {
          documentId: docId,
        }
      );
      if (!document) throw new Error("Document not found");

      // Use cached payment extraction — same storageId = same result
      const extracted = await paymentExtractionCache.fetch(
        toActionCacheCtx(ctx),
        {
          storageId: parse(v.id("_storage"), document.storageId),
        }
      );

      // Validate extracted amounts are reasonable
      for (const item of extracted.lineItems) {
        if (item.unitPriceCents < 0) {
          throw new Error(
            `Invalid negative amount for line item: ${item.description}`
          );
        }
        if (item.unitPriceCents > 100_000_000_00) {
          // > $100M — likely a parsing error
          throw new Error(
            `Suspiciously large amount for line item: ${item.description}`
          );
        }
      }

      // Save the extracted payment config
      await ctx.runMutation(internal.ai.mutations.saveExtractedPaymentConfig, {
        fieldId: parse(v.id("signature_fields"), args.fieldId),
        documentId: docId,
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
        0
      );
      const totalFormatted = formatMoney(
        money(totalCents, extracted.currency.toUpperCase())
      );

      return `Extracted payment config: ${extracted.lineItems.length} line item(s), ${totalFormatted}, ${extracted.paymentType.replace("_", " ")} payment, due ${extracted.dueDateTerms.replace("_", " ")}.`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[SealAI Tool Error] extractPaymentTerms:", msg);
      return `Error extracting payment terms: ${msg}`;
    }
  },
});
