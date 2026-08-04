import { defineTable } from "convex/server";
import { v } from "convex/values";

import { authenticationMethodTuple } from "./recipients";

/**
 * Signatures Table Schema
 *
 * Stores signature data for document fields, including actual signature values,
 * images, authentication data, and audit information.
 *
 * Based on: /docs/design-phase/information-architecture/data-relationships.md
 * Feature: Digital Signature Implementation - Feature #9
 */

export const signaturesTable = defineTable({
  // References
  fieldId: v.id("signature_fields"), // Which field this signature fills
  recipientId: v.id("document_recipients"), // Who signed this field
  documentId: v.id("documents"), // Document being signed (for quick queries)

  // Signature Data
  value: v.optional(v.string()), // For text/date/checkbox fields
  signatureImageUrl: v.optional(v.string()), // For signature fields (stored in Convex Storage)

  // Cryptographic signature data (SEA-108)
  signatureHash: v.optional(v.string()), // SHA-256 hash of signature data for verification
  signatureImageHash: v.optional(v.string()), // SHA-256 hash of just the image data (for reuse detection)
  documentHashAtSigning: v.optional(v.string()), // Document hash at time of signing (tamper detection)
  signatureMethod: v.optional(
    v.union(
      v.literal("draw"), // Hand-drawn signature
      v.literal("type"), // Typed signature
      v.literal("upload") // Uploaded signature image
    )
  ),

  // Audit Information
  signedAt: v.number(), // Timestamp when signed
  ipAddress: v.string(), // IP address of signer
  userAgent: v.string(), // Browser/device information
  authenticationData: v.optional(
    v.object({
      method: authenticationMethodTuple, // Authentication method used
      verified: v.boolean(), // Whether authentication was verified
      verifiedAt: v.optional(v.number()), // When authentication was verified
    })
  ),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_field", ["fieldId"])
  .index("by_recipient", ["recipientId"])
  .index("by_document", ["documentId"])
  .index("by_document_recipient", ["documentId", "recipientId"])
  .index("by_signature_image_hash", ["signatureImageHash"]);
