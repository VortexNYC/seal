import { ConvexError, v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Hash a token using SHA-256 (Web Crypto API available in Convex runtime)
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a cryptographically random token
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a download token for a document.
 * Returns the raw token (to be sent to the user). Only the hash is stored.
 */
export async function createDownloadToken(
  ctx: { db: DatabaseWriter },
  params: {
    documentId: Id<"documents">;
    issuedTo: string;
    expiresInMs?: number;
  }
): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);

  await ctx.db.insert("download_tokens", {
    documentId: params.documentId,
    tokenHash,
    issuedTo: params.issuedTo,
    expiresAt: Date.now() + (params.expiresInMs ?? SEVEN_DAYS_MS),
    revoked: false,
    downloadCount: 0,
    createdAt: Date.now(),
  });

  return rawToken;
}

/**
 * Validate a download token and return the document ID if valid.
 * Also increments the download count.
 */
export const validateAndUseToken = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      documentId: v.id("documents"),
    }),
    v.object({
      valid: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token);

    const record = await ctx.db
      .query("download_tokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();

    if (!record) {
      return { valid: false as const, error: "Invalid download token" };
    }

    if (record.revoked) {
      return { valid: false as const, error: "Download link has been revoked" };
    }

    if (record.expiresAt < Date.now()) {
      return { valid: false as const, error: "Download link has expired" };
    }

    // Track usage
    await ctx.db.patch(record._id, {
      downloadCount: record.downloadCount + 1,
      lastDownloadedAt: Date.now(),
    });

    return { valid: true as const, documentId: record.documentId };
  },
});

/**
 * Revoke all download tokens for a document (e.g., when document is voided).
 */
export const revokeTokensForDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("download_tokens")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    await Promise.all(
      tokens.map((t) => ctx.db.patch(t._id, { revoked: true }))
    );

    return { revoked: tokens.length };
  },
});

/**
 * Clean up expired download tokens (called by cron).
 */
export const cleanupExpiredTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Delete tokens expired more than 30 days ago
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;

    const expired = await ctx.db
      .query("download_tokens")
      .withIndex("by_expires_at")
      .filter((q) => q.lt(q.field("expiresAt"), cutoff))
      .take(100);

    await Promise.all(expired.map((t) => ctx.db.delete(t._id)));

    return { deleted: expired.length };
  },
});

/**
 * Generate a download token via internal mutation (for use from actions).
 * Returns the raw token string.
 */
export const generateTokenInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    issuedTo: v.string(),
  },
  handler: async (ctx, args) => {
    return await createDownloadToken(ctx, {
      documentId: args.documentId,
      issuedTo: args.issuedTo,
    });
  },
});

/**
 * Generate a download token for authenticated users viewing their own completed documents.
 */
export const generateDownloadLink = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.workflowStatus !== "completed") {
      throw new ConvexError(
        "Download links are only available for completed documents"
      );
    }

    const email = identity.email;
    if (!email) {
      throw new ConvexError("User email not found");
    }

    const rawToken = await createDownloadToken(ctx, {
      documentId: args.documentId,
      issuedTo: email,
    });

    return { token: rawToken, expiresInDays: 7 };
  },
});
