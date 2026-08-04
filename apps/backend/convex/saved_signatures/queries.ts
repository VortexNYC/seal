/**
 * Saved Signatures Queries
 *
 * Query functions for retrieving saved signatures from the signature library.
 *
 * SEA-107: Signature Library for Reuse
 */

import { v } from "convex/values";

import { query } from "../_generated/server";

/**
 * Get all saved signatures for the current user
 */
export const getUserSignatures = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      return [];
    }

    const signatures = await ctx.db
      .query("saved_signatures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by usage count (most used first), then by creation date
    return signatures.sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b.createdAt - a.createdAt;
    });
  },
});

/**
 * Get user's default signature
 */
export const getDefaultSignature = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      return null;
    }

    const defaultSignature = await ctx.db
      .query("saved_signatures")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", user._id).eq("isDefault", true)
      )
      .first();

    return defaultSignature;
  },
});

/**
 * Get a specific saved signature by ID
 */
export const getSignatureById = query({
  args: {
    signatureId: v.id("saved_signatures"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      return null;
    }

    const signature = await ctx.db.get(args.signatureId);

    // Ensure the signature belongs to this user
    if (!signature || signature.userId !== user._id) {
      return null;
    }

    return signature;
  },
});

/**
 * Get count of user's saved signatures
 */
export const getSignatureCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    // Get user by auth subject
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) =>
        q.eq("authSubject", identity.subject)
      )
      .first();

    if (!user) {
      return 0;
    }

    const signatures = await ctx.db
      .query("saved_signatures")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return signatures.length;
  },
});
