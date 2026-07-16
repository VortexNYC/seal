import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { authMutation } from "../auth/wrappers";
import { computeTotalAmountCents } from "../payment_fields/helpers";
import {
  annotationCategoryTuple,
  annotationSeverityTuple,
} from "../schemas/ai_document_annotations";
import { dueDateTermsTuple, paymentTypeTuple } from "../schemas/payment_field_configs";
import { fieldTypeTuple } from "../schemas/signature_fields";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Recipient assignment heuristics
// ---------------------------------------------------------------------------

interface FieldForAssignment {
  label: string;
  fieldType: string;
}

/**
 * Match a field's label to the best recipient.
 *
 * Strategy:
 * - 0 signers → undefined (unassigned)
 * - 1 signer  → always that signer
 * - N signers → fuzzy-match label words against recipient name/email,
 *               fall back to order-based assignment for positional labels
 *               (e.g. "Party 1" → first recipient), else undefined
 */
function assignRecipient(
  field: FieldForAssignment,
  signers: Doc<"document_recipients">[],
): Doc<"document_recipients">["_id"] | undefined {
  if (signers.length === 0) return undefined;
  if (signers.length === 1) return sealAssertPresent(signers[0])._id;

  const label = field.label.toLowerCase();

  // Try name match: does the label contain any signer's name?
  for (const signer of signers) {
    const name = signer.name?.toLowerCase();
    if (name && name.length > 2 && label.includes(name)) {
      return signer._id;
    }
    // Also match email prefix (before @)
    const emailPrefix = sealAssertPresent(signer.email.split("@")[0]).toLowerCase();
    if (emailPrefix.length > 2 && label.includes(emailPrefix)) {
      return signer._id;
    }
  }

  // Try ordinal/positional: "party 1", "signer 2", "first", "second"
  const ordinalPatterns: [RegExp, number][] = [
    [/\b(?:party|signer|recipient|person)\s*[#]?1\b/, 0],
    [/\b(?:party|signer|recipient|person)\s*[#]?2\b/, 1],
    [/\b(?:party|signer|recipient|person)\s*[#]?3\b/, 2],
    [/\bfirst\b/, 0],
    [/\bsecond\b/, 1],
    [/\bthird\b/, 2],
    [/\bbuyer\b|\bpurchaser\b|\btenant\b|\blessee\b|\bemployee\b/, 0],
    [/\bseller\b|\bvendor\b|\blandlord\b|\blessor\b|\bemployer\b/, 1],
  ];

  for (const [pattern, index] of ordinalPatterns) {
    if (pattern.test(label) && index < signers.length) {
      return sealAssertPresent(signers[index])._id;
    }
  }

  // No confident match — leave unassigned
  return undefined;
}

async function createPaymentConfigsFromExtraction(
  ctx: Pick<MutationCtx, "db">,
  suggestion: Doc<"ai_field_suggestions">,
  paymentFieldIds: Id<"signature_fields">[],
  now: number,
): Promise<void> {
  if (paymentFieldIds.length === 0 || !suggestion.paymentExtraction) return;

  const ext = suggestion.paymentExtraction;
  const items = ext.lineItems.map((item, i) => ({
    id: `ai-${i}-${now}`,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPriceCents,
  }));
  const totalAmountCents = computeTotalAmountCents(items);

  for (const fieldId of paymentFieldIds) {
    await ctx.db.insert("payment_field_configs", {
      fieldId,
      documentId: suggestion.documentId,
      organizationId: suggestion.organizationId,
      paymentType: ext.paymentType,
      items,
      currency: ext.currency.toLowerCase(),
      dueDateTerms: ext.dueDateTerms,
      customDueDays: ext.customDueDays,
      customDueDate: ext.customDueDate,
      lateFees: ext.lateFee
        ? {
            enabled: true,
            type: ext.lateFee.type,
            amount: ext.lateFee.amount,
            gracePeriodDays: ext.lateFee.gracePeriodDays,
          }
        : undefined,
      recurringConfig: ext.recurringConfig
        ? {
            interval: ext.recurringConfig.interval,
            intervalCount: ext.recurringConfig.intervalCount,
            endCondition: "never" as const,
          }
        : undefined,
      installmentsConfig: ext.installmentsConfig
        ? {
            count: ext.installmentsConfig.count,
            interval: ext.installmentsConfig.interval,
          }
        : undefined,
      depositBalanceConfig: ext.depositBalanceConfig
        ? {
            depositPercent: ext.depositBalanceConfig.depositPercent,
            balanceDueDays: ext.depositBalanceConfig.balanceDueDays,
          }
        : undefined,
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const saveFieldSuggestions = internalMutation({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    fields: v.array(
      v.object({
        fieldType: fieldTypeTuple,
        page: v.number(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        label: v.string(),
        confidence: v.number(),
        isRequired: v.boolean(),
      }),
    ),
    modelUsed: v.string(),
    tokensUsed: v.number(),
    processingTimeMs: v.number(),
  },
  handler: async (ctx, args) => {
    // Dismiss any existing pending suggestions for this document. This must inspect every pending suggestion for the document; no rows are dropped.
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId and status, complete pending-suggestion set is required before inserting the replacement
    const existing = await ctx.db
      .query("ai_field_suggestions")
      .withIndex("by_document_status", (q) =>
        q.eq("documentId", args.documentId).eq("status", "pending"),
      )
      .collect();

    for (const suggestion of existing) {
      await ctx.db.patch(suggestion._id, { status: "dismissed" as const });
    }

    return await ctx.db.insert("ai_field_suggestions", {
      documentId: args.documentId,
      organizationId: args.organizationId,
      fields: args.fields,
      modelUsed: args.modelUsed,
      tokensUsed: args.tokensUsed,
      processingTimeMs: args.processingTimeMs,
      status: "pending",
    });
  },
});

export const applyFieldSuggestions = authMutation({
  args: {
    suggestionId: v.id("ai_field_suggestions"),
    selectedFieldIndices: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) throw new ConvexError("Suggestions not found");
    if (suggestion.status !== "pending") throw new ConvexError("Suggestions already processed");

    const document = await ctx.db.get(suggestion.documentId);
    if (!document) throw new ConvexError("Document not found");

    // Get signer recipients sorted by order for heuristic assignment. This must inspect every document recipient so assignment remains complete.
    // convex-cost-guard-allow: convex-query-filter-before-collect — scoped to a single documentId, bounded by document recipient count; the role filter cannot drop unchecked recipients before assignment
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId, bounded by document recipient count and preserves all signers
    const signers = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", suggestion.documentId))
      .filter((q) => q.eq(q.field("role"), "signer"))
      .collect();
    signers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const fieldsToApply = args.selectedFieldIndices
      ? suggestion.fields.filter((_, i) => args.selectedFieldIndices?.includes(i))
      : suggestion.fields;

    const fieldIds: Id<"signature_fields">[] = [];
    const paymentFieldIds: Id<"signature_fields">[] = [];
    const now = Date.now();

    for (const field of fieldsToApply) {
      const recipientId = assignRecipient(field, signers);
      const fieldId = await ctx.db.insert("signature_fields", {
        documentId: suggestion.documentId,
        recipientId,
        fieldType: field.fieldType,
        label: field.label,
        isRequired: field.isRequired,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page,
        createdAt: now,
        updatedAt: now,
      });
      fieldIds.push(fieldId);

      if (field.fieldType === "payment") {
        paymentFieldIds.push(fieldId);
      }
    }

    await ctx.db.patch(args.suggestionId, { status: "applied" as const });

    await createPaymentConfigsFromExtraction(ctx, suggestion, paymentFieldIds, now);

    return { fieldIds, count: fieldIds.length };
  },
});

export const dismissFieldSuggestions = authMutation({
  args: { suggestionId: v.id("ai_field_suggestions") },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion) throw new ConvexError("Suggestions not found");

    await ctx.db.patch(args.suggestionId, { status: "dismissed" as const });
  },
});

// ---------------------------------------------------------------------------
// Payment extraction → payment_field_configs
// ---------------------------------------------------------------------------

/**
 * Save AI-extracted payment terms as a payment_field_configs record.
 * Used by the agent tool for conversational payment extraction.
 */
export const saveExtractedPaymentConfig = internalMutation({
  args: {
    fieldId: v.id("signature_fields"),
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    extraction: v.object({
      lineItems: v.array(
        v.object({
          description: v.string(),
          quantity: v.number(),
          unitPriceCents: v.number(),
        }),
      ),
      currency: v.string(),
      paymentType: paymentTypeTuple,
      dueDateTerms: dueDateTermsTuple,
      customDueDays: v.optional(v.number()),
      customDueDate: v.optional(v.string()),
      lateFee: v.optional(
        v.object({
          type: v.union(v.literal("percentage"), v.literal("fixed")),
          amount: v.number(),
          gracePeriodDays: v.number(),
        }),
      ),
      recurringConfig: v.optional(
        v.object({
          interval: v.union(v.literal("week"), v.literal("month"), v.literal("year")),
          intervalCount: v.number(),
        }),
      ),
      installmentsConfig: v.optional(
        v.object({
          count: v.number(),
          interval: v.union(v.literal("week"), v.literal("month")),
        }),
      ),
      depositBalanceConfig: v.optional(
        v.object({
          depositPercent: v.number(),
          balanceDueDays: v.number(),
        }),
      ),
    }),
  },
  handler: async (ctx, args) => {
    // Verify the field exists and is a payment field
    const field = await ctx.db.get(args.fieldId);
    if (!field) throw new ConvexError("Payment field not found");
    if (field.fieldType !== "payment") throw new ConvexError("Field is not a payment type");

    const { extraction } = args;

    // Map AI line items to payment config format (add generated IDs)
    const items = extraction.lineItems.map((item, i) => ({
      id: `ai-${i}-${Date.now()}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPriceCents,
    }));

    const totalAmountCents = computeTotalAmountCents(items);

    // Build late fee config if extracted
    const lateFees = extraction.lateFee
      ? {
          enabled: true,
          type: extraction.lateFee.type as "percentage" | "fixed",
          amount: extraction.lateFee.amount,
          gracePeriodDays: extraction.lateFee.gracePeriodDays,
        }
      : undefined;

    // Build recurring config with sensible defaults
    const recurringConfig = extraction.recurringConfig
      ? {
          interval: extraction.recurringConfig.interval as "week" | "month" | "year",
          intervalCount: extraction.recurringConfig.intervalCount,
          endCondition: "never" as const,
        }
      : undefined;

    // Build installments config
    const installmentsConfig = extraction.installmentsConfig
      ? {
          count: extraction.installmentsConfig.count,
          interval: extraction.installmentsConfig.interval as "week" | "month",
        }
      : undefined;

    // Build deposit/balance config
    const depositBalanceConfig = extraction.depositBalanceConfig
      ? {
          depositPercent: extraction.depositBalanceConfig.depositPercent,
          balanceDueDays: extraction.depositBalanceConfig.balanceDueDays,
        }
      : undefined;

    const now = Date.now();

    // Check for existing config — upsert pattern
    const existing = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_field", (q) => q.eq("fieldId", args.fieldId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        paymentType: extraction.paymentType,
        items,
        currency: extraction.currency.toLowerCase(),
        dueDateTerms: extraction.dueDateTerms,
        customDueDays: extraction.customDueDays,
        customDueDate: extraction.customDueDate,
        lateFees,
        recurringConfig,
        installmentsConfig,
        depositBalanceConfig,
        totalAmountCents,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("payment_field_configs", {
      fieldId: args.fieldId,
      documentId: args.documentId,
      organizationId: args.organizationId,
      paymentType: extraction.paymentType,
      items,
      currency: extraction.currency.toLowerCase(),
      dueDateTerms: extraction.dueDateTerms,
      customDueDays: extraction.customDueDays,
      customDueDate: extraction.customDueDate,
      lateFees,
      recurringConfig,
      installmentsConfig,
      depositBalanceConfig,
      // Sensible defaults for fields AI can't infer
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents,
      paymentStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Document annotations (redlining)
// ---------------------------------------------------------------------------

export const saveDocumentAnnotations = internalMutation({
  args: {
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    annotations: v.array(
      v.object({
        page: v.number(),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        category: annotationCategoryTuple,
        severity: annotationSeverityTuple,
        text: v.string(),
        summary: v.string(),
      }),
    ),
    modelUsed: v.string(),
    tokensUsed: v.number(),
    processingTimeMs: v.number(),
    // When true, overrides a previous user dismissal (used on PDF replace)
    forceOverrideDismissal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check all existing annotation records for this document. Dismissal semantics require the complete document annotation set.
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to a single documentId; all annotation rows are required to honor prior user dismissals and dismiss active replacements
    const existing = await ctx.db
      .query("ai_document_annotations")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // If user previously dismissed annotations, respect their choice —
    // unless this is a fresh analysis for a new PDF (forceOverrideDismissal)
    if (!args.forceOverrideDismissal) {
      const userDismissed = existing.some((a) => a.status === "dismissed");
      if (userDismissed) return null;
    }

    // Dismiss any existing active/pending annotations
    for (const annotation of existing) {
      if (annotation.status === "active" || annotation.status === "pending") {
        await ctx.db.patch(annotation._id, { status: "dismissed" as const });
      }
    }

    // Skip if no annotations detected
    if (args.annotations.length === 0) return null;

    return await ctx.db.insert("ai_document_annotations", {
      documentId: args.documentId,
      organizationId: args.organizationId,
      annotations: args.annotations,
      modelUsed: args.modelUsed,
      tokensUsed: args.tokensUsed,
      processingTimeMs: args.processingTimeMs,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const dismissDocumentAnnotations = authMutation({
  args: { annotationId: v.id("ai_document_annotations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.annotationId, { status: "dismissed" as const });
  },
});
