/**
 * Saved Signatures Mutations
 *
 * Mutation functions for managing the signature library.
 *
 * SEA-107: Signature Library for Reuse
 */

import { ConvexError, v } from "convex/values";

import { mutation } from "../_generated/server";
import { signatureTypeTuple } from "../schemas/saved_signatures";

/**
 * Save a new signature to the library
 */
export const saveSignature = mutation({
  args: {
    name: v.string(),
    signatureImageUrl: v.string(),
    signatureType: signatureTypeTuple,
    fontFamily: v.optional(v.string()),
    setAsDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Check signature limit (max 10 per user)
    const existingSignatures = await ctx.db
      .query("saved_signatures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (existingSignatures.length >= 10) {
      throw new ConvexError(
        "You can only save up to 10 signatures. Please delete one to add a new one."
      );
    }

    const now = Date.now();
    const isDefault = args.setAsDefault ?? existingSignatures.length === 0; // First signature is default

    // If setting as default, unset existing default
    if (isDefault) {
      const currentDefault = existingSignatures.find((s) => s.isDefault);
      if (currentDefault) {
        await ctx.db.patch(currentDefault._id, { isDefault: false });
      }
    }

    const signatureId = await ctx.db.insert("saved_signatures", {
      userId: user._id,
      name: args.name,
      signatureImageUrl: args.signatureImageUrl,
      signatureType: args.signatureType,
      fontFamily: args.fontFamily,
      isDefault,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { signatureId };
  },
});

/**
 * Update a saved signature
 */
export const updateSignature = mutation({
  args: {
    signatureId: v.id("saved_signatures"),
    name: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const signature = await ctx.db.get(args.signatureId);
    if (!signature || signature.userId !== user._id) {
      throw new ConvexError("Signature not found");
    }

    // If setting as default, unset existing default
    if (args.isDefault === true) {
      const existingSignatures = await ctx.db
        .query("saved_signatures")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      const currentDefault = existingSignatures.find(
        (s) => s.isDefault && s._id !== args.signatureId
      );
      if (currentDefault) {
        await ctx.db.patch(currentDefault._id, { isDefault: false });
      }
    }

    const updates: { name?: string; isDefault?: boolean; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }

    await ctx.db.patch(args.signatureId, updates);

    return { success: true };
  },
});

/**
 * Delete a saved signature
 */
export const deleteSignature = mutation({
  args: {
    signatureId: v.id("saved_signatures"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const signature = await ctx.db.get(args.signatureId);
    if (!signature || signature.userId !== user._id) {
      throw new ConvexError("Signature not found");
    }

    await ctx.db.delete(args.signatureId);

    // If deleted was default, set another as default
    if (signature.isDefault) {
      const remainingSignatures = await ctx.db
        .query("saved_signatures")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      if (remainingSignatures.length > 0) {
        // Set the most recently created as default
        const mostRecent = remainingSignatures.sort(
          (a, b) => b.createdAt - a.createdAt
        )[0];
        if (mostRecent) {
          await ctx.db.patch(mostRecent._id, { isDefault: true });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Increment usage count when a saved signature is used
 */
export const incrementUsageCount = mutation({
  args: {
    signatureId: v.id("saved_signatures"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized");
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const signature = await ctx.db.get(args.signatureId);
    if (!signature || signature.userId !== user._id) {
      throw new ConvexError("Signature not found");
    }

    await ctx.db.patch(args.signatureId, {
      usageCount: signature.usageCount + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
