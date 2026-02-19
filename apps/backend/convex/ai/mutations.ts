import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { authMutation } from "../auth/wrappers";
import { fieldTypeTuple } from "../schemas/signature_fields";

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
  if (signers.length === 1) return signers[0]._id;

  const label = field.label.toLowerCase();

  // Try name match: does the label contain any signer's name?
  for (const signer of signers) {
    const name = signer.name?.toLowerCase();
    if (name && name.length > 2 && label.includes(name)) {
      return signer._id;
    }
    // Also match email prefix (before @)
    const emailPrefix = signer.email.split("@")[0].toLowerCase();
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
      return signers[index]._id;
    }
  }

  // No confident match — leave unassigned
  return undefined;
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
    // Dismiss any existing pending suggestions for this document
    const existing = await ctx.db
      .query("ai_field_suggestions")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .filter((q) => q.eq(q.field("status"), "pending"))
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

    // Get signer recipients sorted by order for heuristic assignment
    const signers = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", suggestion.documentId))
      .filter((q) => q.eq(q.field("role"), "signer"))
      .collect();
    signers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const fieldsToApply = args.selectedFieldIndices
      ? suggestion.fields.filter((_, i) => args.selectedFieldIndices?.includes(i))
      : suggestion.fields;

    const fieldIds = [];
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
    }

    await ctx.db.patch(args.suggestionId, { status: "applied" as const });

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
