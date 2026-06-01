/**
 * Query and mutation wrappers for recipient token-based access
 *
 * These wrappers automatically validate signing tokens and apply
 * Row-Level Security (RLS) scoped to the authenticated recipient.
 *
 * Unlike auth wrappers, these do NOT require Clerk authentication.
 * Token validation is enforced automatically in the wrapper; handlers
 * receive a pre-validated recipient context and a scoped db.
 */

import {
  customCtxAndArgs,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { wrapDatabaseReader, wrapDatabaseWriter } from "convex-helpers/server/rowLevelSecurity";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { findRecipientByToken } from "../documents/recipient_helpers";
import { recipientRlsRules } from "../rls";
import type { RecipientRole, RecipientStatus } from "../schemas/document_recipients";

export interface RecipientContext {
  recipientId: Id<"document_recipients">;
  documentId: Id<"documents">;
  email: string;
  role: RecipientRole;
  status: RecipientStatus;
}

async function validateRecipientToken(
  ctx: Pick<QueryCtx, "db">,
  signingToken: string,
): Promise<Doc<"document_recipients">> {
  const recipient = await findRecipientByToken(ctx, signingToken);

  if (!recipient) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Invalid signing token",
    });
  }

  if (recipient.tokenExpiresAt < Date.now()) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Signing token has expired",
    });
  }

  if (recipient.status === "declined") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Cannot access document: signing was declined",
    });
  }

  return recipient;
}

/**
 * Query wrapper for recipient token-based access
 *
 * Automatically validates the signing token and applies RLS
 * scoped to the authenticated recipient.
 *
 * @example
 * export const getDocumentByToken = recipientQuery({
 *   args: {},
 *   handler: async (ctx, _args) => {
 *     const document = await ctx.db.get(ctx.recipient.documentId);
 *     return document;
 *   },
 * });
 */
export const recipientQuery = customQuery(
  query,
  customCtxAndArgs({
    args: { signingToken: v.string() },
    input: async (ctx, args) => {
      const recipient = await validateRecipientToken(ctx, args.signingToken);
      const recipientContext: RecipientContext = {
        recipientId: recipient._id,
        documentId: recipient.documentId,
        email: recipient.email,
        role: recipient.role,
        status: recipient.status,
      };
      const rules = recipientRlsRules(ctx, recipientContext);
      return {
        ctx: {
          recipient: recipientContext,
          db: wrapDatabaseReader(ctx, ctx.db, rules, { defaultPolicy: "deny" }),
        },
        args: {},
      };
    },
  }),
);

/**
 * Mutation wrapper for recipient token-based access
 *
 * Automatically validates the signing token, enforces that the
 * recipient has not already completed their action, and applies
 * RLS scoped to the authenticated recipient.
 *
 * @example
 * export const submitSignature = recipientMutation({
 *   args: { signatureData: v.string() },
 *   handler: async (ctx, args) => {
 *     await ctx.db.patch(ctx.recipient.recipientId, {
 *       status: "signed",
 *       signedAt: Date.now(),
 *     });
 *   },
 * });
 */
export const recipientMutation = customMutation(
  mutation,
  customCtxAndArgs({
    args: { signingToken: v.string() },
    input: async (ctx, args) => {
      const recipient = await validateRecipientToken(ctx, args.signingToken);

      if (recipient.status === "signed" || recipient.status === "approved") {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Document action has already been completed",
        });
      }

      const recipientContext: RecipientContext = {
        recipientId: recipient._id,
        documentId: recipient.documentId,
        email: recipient.email,
        role: recipient.role,
        status: recipient.status,
      };
      const rules = recipientRlsRules(ctx, recipientContext);
      return {
        ctx: {
          recipient: recipientContext,
          db: wrapDatabaseWriter(ctx, ctx.db, rules, { defaultPolicy: "deny" }),
        },
        args: {},
      };
    },
  }),
);
