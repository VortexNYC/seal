import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Download Tokens Schema
 *
 * Time-limited tokens for secure document download links.
 * Tokens are generated when a document is completed and sent to all signers.
 * Each token grants access to download a specific document's signed PDF.
 */
export const downloadTokensTable = defineTable({
  // The document this token grants access to
  documentId: v.id("documents"),

  // SHA-256 hash of the token (the raw token is sent to the user, only the hash is stored)
  tokenHash: v.string(),

  // Who this token was issued to (email address)
  issuedTo: v.string(),

  // Expiration timestamp (default: 7 days from creation)
  expiresAt: v.number(),

  // Whether the token has been revoked
  revoked: v.boolean(),

  // Track downloads for audit
  downloadCount: v.number(),
  lastDownloadedAt: v.optional(v.number()),

  // Timestamps
  createdAt: v.number(),
})
  .index("by_token_hash", ["tokenHash"])
  .index("by_document", ["documentId"])
  .index("by_expires_at", ["expiresAt"]);
