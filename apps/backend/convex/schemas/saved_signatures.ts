import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Saved Signatures Table Schema
 *
 * Stores user's saved signatures for quick reuse.
 * Users can save their drawn, typed, or uploaded signatures
 * to their signature library for future use.
 *
 * SEA-107: Signature Library for Reuse
 */

export const signatureTypeTuple = v.union(
  v.literal("drawn"),
  v.literal("typed"),
  v.literal("uploaded")
);

export type SignatureType = "drawn" | "typed" | "uploaded";

export const savedSignaturesTable = defineTable({
  // Owner - can be a user (for personal signatures) or organization (for shared)
  betterAuthUserId: v.optional(v.string()),
  betterAuthOrganizationId: v.optional(v.string()),
  userId: v.id("users"), // The user who created this signature
  organizationId: v.optional(v.id("organizations")), // Optional: if shared across org

  // Signature data
  name: v.string(), // User-provided name for the signature (e.g., "My Formal Signature")
  signatureImageUrl: v.string(), // Base64 data URL of the signature image
  signatureType: signatureTypeTuple, // How the signature was created

  // For typed signatures, store the font used
  fontFamily: v.optional(v.string()),

  // Metadata
  isDefault: v.boolean(), // Whether this is the user's default signature
  usageCount: v.number(), // How many times this signature has been used

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_better_auth_user", ["betterAuthUserId"])
  .index("by_user", ["userId"])
  .index("by_better_auth_user_default", ["betterAuthUserId", "isDefault"])
  .index("by_user_default", ["userId", "isDefault"])
  .index("by_better_auth_organization", ["betterAuthOrganizationId"])
  .index("by_organization", ["organizationId"]);
