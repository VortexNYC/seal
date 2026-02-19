import { ConvexError, v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { authMutation } from "../auth/wrappers";
import { fieldTypeTuple } from "../schemas/signature_fields";

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

    // Get first signer recipient as default assignment
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", suggestion.documentId))
      .filter((q) => q.eq(q.field("role"), "signer"))
      .collect();
    const defaultRecipientId = recipients[0]?._id;

    const fieldsToApply = args.selectedFieldIndices
      ? suggestion.fields.filter((_, i) => args.selectedFieldIndices?.includes(i))
      : suggestion.fields;

    const fieldIds = [];
    const now = Date.now();

    for (const field of fieldsToApply) {
      const fieldId = await ctx.db.insert("signature_fields", {
        documentId: suggestion.documentId,
        recipientId: defaultRecipientId,
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
