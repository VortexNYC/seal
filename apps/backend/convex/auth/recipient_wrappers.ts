/**
 * Query and mutation wrappers for recipient token-based access
 *
 * These wrappers are used for unauthenticated access where recipients
 * access documents via signing tokens (email links).
 *
 * Unlike auth wrappers, these do NOT require Clerk authentication.
 * Token validation must happen in the handler using validateRecipientToken.
 *
 * Note: RLS is NOT applied to these wrappers. Access control is enforced
 * via token validation which scopes access to the specific document.
 */

import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import type { RecipientRole } from "../schemas/document_recipients";

/**
 * Recipient context from token validation
 * Uses document_recipients table with signingToken
 */
export interface RecipientContext {
  recipientId: Id<"document_recipients">;
  documentId: Id<"documents">;
  email: string;
  role: RecipientRole;
}

/**
 * Query wrapper for recipient token-based access
 *
 * Provides a validateRecipientToken helper to validate signing tokens
 * and get recipient context. Access to documents is scoped by token.
 *
 * Note: RLS is NOT applied - access control via token validation.
 *
 * @example
 * export const getDocumentByToken = recipientQuery({
 *   args: { signingToken: v.string() },
 *   handler: async (ctx, args) => {
 *     const recipient = await ctx.validateRecipientToken(args.signingToken);
 *     // Now you can access the specific document
 *     const document = await ctx.db.get(recipient.documentId);
 *     return document;
 *   },
 * });
 */
export const recipientQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    // Helper to validate token and get recipient context
    const validateRecipientToken = async (signingToken: string): Promise<RecipientContext> => {
      // Use document_recipients table with by_token index
      const recipient = await ctx.db
        .query("document_recipients")
        .withIndex("by_token", (q) => q.eq("signingToken", signingToken))
        .first();

      if (!recipient) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Invalid signing token",
        });
      }

      // Check token expiration
      if (recipient.tokenExpiresAt < Date.now()) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Signing token has expired",
        });
      }

      // Check recipient status
      if (recipient.status === "declined") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Cannot access document: signing was declined",
        });
      }

      return {
        recipientId: recipient._id,
        documentId: recipient.documentId,
        email: recipient.email,
        role: recipient.role,
      };
    };

    return {
      validateRecipientToken,
      // Raw db access - access control via token validation
      db: ctx.db,
    };
  }),
);

/**
 * Mutation wrapper for recipient token-based access
 *
 * Used for recipient actions like signing documents.
 * Includes additional check that document hasn't already been signed.
 *
 * Note: RLS is NOT applied - access control via token validation.
 *
 * @example
 * export const submitSignature = recipientMutation({
 *   args: {
 *     signingToken: v.string(),
 *     signatureData: v.string(),
 *   },
 *   handler: async (ctx, args) => {
 *     const recipient = await ctx.validateRecipientToken(args.signingToken);
 *     // Update recipient status
 *     await ctx.db.patch(recipient.recipientId, {
 *       status: "signed",
 *       signedAt: Date.now(),
 *     });
 *   },
 * });
 */
export const recipientMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    // Helper to validate token and get recipient context
    const validateRecipientToken = async (signingToken: string): Promise<RecipientContext> => {
      // Use document_recipients table with by_token index
      const recipient = await ctx.db
        .query("document_recipients")
        .withIndex("by_token", (q) => q.eq("signingToken", signingToken))
        .first();

      if (!recipient) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Invalid signing token",
        });
      }

      // Check token expiration
      if (recipient.tokenExpiresAt < Date.now()) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Signing token has expired",
        });
      }

      // Check recipient status
      if (recipient.status === "declined") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Cannot access document: signing was declined",
        });
      }

      // For mutations, also check if already signed/approved
      if (recipient.status === "signed" || recipient.status === "approved") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Document action has already been completed",
        });
      }

      return {
        recipientId: recipient._id,
        documentId: recipient.documentId,
        email: recipient.email,
        role: recipient.role,
      };
    };

    return {
      validateRecipientToken,
      // Raw db access - access control via token validation
      db: ctx.db,
    };
  }),
);
