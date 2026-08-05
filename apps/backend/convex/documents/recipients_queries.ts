/**
 * Document recipients queries for Seal
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { authQuery } from "../auth";
import {
  ACCESS_ERRORS,
  checkDocumentAccess,
  getDocumentOrThrow,
} from "../auth/access_control";
import {
  loadSuiteOrgBrandAndSecurity,
  resolveEffectiveBrandingSettings,
  type SuiteOrgBrand,
} from "../lib/suiteOrgPolicy";
import {
  isRecipientComplete,
  isRecipientTerminal,
} from "../schemas/document_recipients";
import {
  findRecipientByToken,
  groupRecipientsByOrder,
  isRecipientGroupActive,
} from "./recipient_helpers";

function getSequentialProgress(recipients: Doc<"document_recipients">[]): {
  currentGroup: number;
  totalGroups: number;
} {
  const groups = groupRecipientsByOrder(recipients);
  const sortedOrders = [...groups.keys()];
  let currentGroup = 0;

  for (let index = 0; index < sortedOrders.length; index++) {
    const group = groups.get(sortedOrders[index]);
    if (!group) {
      continue;
    }
    if (!group.every((recipient) => isRecipientTerminal(recipient.status))) {
      currentGroup = index;
      break;
    }
    if (index === sortedOrders.length - 1) {
      currentGroup = index;
    }
  }

  return {
    currentGroup: currentGroup + 1,
    totalGroups: sortedOrders.length,
  };
}

async function getSequentialSigningState(
  ctx: QueryCtx,
  document: Doc<"documents">,
  recipient: Doc<"document_recipients">
): Promise<{
  waitingForPreviousGroup: boolean;
  sequentialProgress?: { currentGroup: number; totalGroups: number };
}> {
  if (document.signingMode !== "sequential") {
    return {
      waitingForPreviousGroup: false,
      sequentialProgress: undefined,
    };
  }

  const allRecipients = [];
  for await (const _row of ctx.db
    .query("document_recipients")
    .withIndex("by_document", (q) =>
      q.eq("documentId", recipient.documentId)
    )) {
    allRecipients.push(_row);
  }

  return {
    waitingForPreviousGroup: !isRecipientGroupActive(recipient, allRecipients),
    sequentialProgress: getSequentialProgress(allRecipients),
  };
}

function buildRecipientTokenResponse(
  ownerName: string,
  recipient: Doc<"document_recipients">,
  document: Doc<"documents">,
  organization: Doc<"organizations"> | null,
  sequentialState: Awaited<ReturnType<typeof getSequentialSigningState>>,
  suiteBrand?: SuiteOrgBrand
) {
  const local = organization?.brandingSettings;
  const effective = organization
    ? resolveEffectiveBrandingSettings(organization, suiteBrand)
    : undefined;
  const hasSigningChrome =
    local?.hideSealBranding === true || Boolean(local?.customFooterText);
  const branding =
    effective !== undefined && (effective.enabled || hasSigningChrome)
      ? {
          logoUrl: effective.logoUrl,
          brandColor: effective.brandColor,
          accentColor: effective.accentColor,
          hideSealBranding: local?.hideSealBranding,
          customFooterText: local?.customFooterText,
          enabled: effective.enabled,
        }
      : undefined;

  return {
    ownerName,
    recipient: {
      _id: recipient._id,
      documentId: recipient.documentId,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      status: recipient.status,
      viewedAt: recipient.viewedAt,
      signedAt: recipient.signedAt,
      approvedAt: recipient.approvedAt,
      declinedAt: recipient.declinedAt,
      signatureData: recipient.signatureData,
      signatureType: recipient.signatureType,
      esignConsentAt: recipient.esignConsentAt,
      expiresAt: recipient.expiresAt,
      awaitingDictation: recipient.awaitingDictation,
    },
    document: {
      _id: document._id,
      name: document.name,
      description: document.description,
      fileType: document.fileType,
      storageId: document.storageId,
      workflowStatus: document.workflowStatus,
      signingMode: document.signingMode,
      redirectUrl: document.redirectUrl,
    },
    waitingForPreviousGroup: sequentialState.waitingForPreviousGroup,
    sequentialProgress: sequentialState.sequentialProgress,
    branding: branding
      ? {
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
          accentColor: branding.accentColor,
          hideSealBranding: branding.hideSealBranding,
          customFooterText: branding.customFooterText,
        }
      : undefined,
    signingSettings: organization?.signingSettings
      ? {
          allowedSignatureTypes:
            organization.signingSettings.allowedSignatureTypes,
          esignConsentText: organization.signingSettings.esignConsentText,
        }
      : undefined,
  };
}

/**
 * Get all recipients for a document
 * Only accessible by document owner or recipients themselves
 */
export const getDocumentRecipients = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get the document
    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 2. Verify access (owner or recipient)
    const isOwner = document.ownerId === userId;
    let isRecipient = false;

    if (!isOwner) {
      // Check if user is a recipient by email
      const user = await ctx.db.get("users", userId);
      if (user) {
        const userEmail = user.email?.toLowerCase() || "";
        let recipient = null;
        for await (const row of ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) =>
            q.eq("documentId", args.documentId)
          )) {
          if (row.email === userEmail) {
            recipient = row;
            break;
          }
        }
        isRecipient = recipient !== null;
      }
    }

    if (!isOwner && !isRecipient) {
      throw new ConvexError("You don't have access to this document");
    }

    // 3. Get all recipients
    const recipients = [];
    for await (const _row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      recipients.push(_row);
    }

    // 4. Sort by order if specified, otherwise by creation time
    const sortedRecipients = recipients.toSorted((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.createdAt - b.createdAt;
    });

    // 5. Sanitize sensitive data if not owner
    if (!isOwner) {
      return sortedRecipients.map((r) => ({
        _id: r._id,
        documentId: r.documentId,
        email: r.email,
        name: r.name,
        role: r.role,
        status: r.status,
        order: r.order,
        // Hide token and sensitive timestamps from non-owners
        viewedAt: r.viewedAt,
        signedAt: r.signedAt,
        approvedAt: r.approvedAt,
        declinedAt: r.declinedAt,
        createdAt: r.createdAt,
        // Include signature data for viewing
        signatureData: r.signatureData,
        signatureType: r.signatureType,
      }));
    }

    // Owner sees everything including signing tokens
    return sortedRecipients;
  },
});

/**
 * Get a recipient by signing token (unauthenticated access)
 * This allows recipients to access the signing page via their unique link
 */
export const getRecipientByToken = query({
  args: {
    signingToken: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find recipient by token (hash-based lookup with plaintext fallback)
    const recipient = await findRecipientByToken(ctx, args.signingToken);

    if (!recipient) {
      throw new ConvexError("Invalid signing token");
    }

    // 2. Check token expiration
    if (recipient.tokenExpiresAt < Date.now()) {
      throw new ConvexError("Signing token has expired");
    }

    // 3. Get the document (without access control since they have the token)
    const document = await ctx.db.get("documents", recipient.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // 3a. Get document owner name for display
    const owner = await ctx.db.get("users", document.ownerId);
    const ownerName = owner?.name || owner?.email || "the sender";

    const organization = document.organizationId
      ? await ctx.db.get("organizations", document.organizationId)
      : null;
    const suitePolicy = organization
      ? await loadSuiteOrgBrandAndSecurity(ctx, organization)
      : undefined;
    const sequentialState = await getSequentialSigningState(
      ctx,
      document,
      recipient
    );
    return buildRecipientTokenResponse(
      ownerName,
      recipient,
      document,
      organization,
      sequentialState,
      suitePolicy?.brand
    );
  },
});

/**
 * Calculate recipient progress for a document
 * Shows completion percentage and breakdown by status
 */
export const getRecipientProgress = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);

    const accessResult = await checkDocumentAccess(ctx, userId, document);
    if (!accessResult.hasAccess) {
      throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
    }

    // Get all recipients
    const recipients = [];
    for await (const _row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      recipients.push(_row);
    }

    if (recipients.length === 0) {
      return {
        total: 0,
        completed: 0,
        percentComplete: 0,
        byStatus: {
          pending: 0,
          viewed: 0,
          signed: 0,
          approved: 0,
          declined: 0,
        },
        byRole: {
          signer: { total: 0, completed: 0 },
          viewer: { total: 0, completed: 0 },
          approver: { total: 0, completed: 0 },
        },
      };
    }

    // 4. Calculate statistics
    const total = recipients.length;
    let completed = 0;
    const byStatus = {
      pending: 0,
      viewed: 0,
      signed: 0,
      approved: 0,
      declined: 0,
      expired: 0,
    };
    const byRole = {
      signer: { total: 0, completed: 0 },
      viewer: { total: 0, completed: 0 },
      approver: { total: 0, completed: 0 },
    };

    for (const recipient of recipients) {
      // Count by status
      byStatus[recipient.status]++;

      // Count by role
      byRole[recipient.role].total++;

      // Check if completed
      if (isRecipientComplete(recipient.role, recipient.status)) {
        completed++;
        byRole[recipient.role].completed++;
      }
    }

    const percentComplete = Math.round((completed / total) * 100);

    return {
      total,
      completed,
      percentComplete,
      byStatus,
      byRole,
    };
  },
});

/**
 * Get all documents where the current user is a recipient
 */
export const getMyRecipientDocuments = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    // 1. Get user email
    const user = await ctx.db.get("users", userId);
    if (!user || !user.email) {
      return [];
    }

    // 2. Get all recipients with user's email
    const recipients = [];
    for await (const _row of ctx.db
      .query("document_recipients")
      .withIndex("by_email", (q) => q.eq("email", user.email.toLowerCase()))) {
      recipients.push(_row);
    }

    // 3. Get documents for each recipient
    const documentsMap = new Map();
    for (const recipient of recipients) {
      if (!documentsMap.has(recipient.documentId)) {
        const document = await ctx.db.get("documents", recipient.documentId);
        if (document && document.status !== "deleted") {
          documentsMap.set(recipient.documentId, {
            document,
            recipient,
          });
        }
      }
    }

    // 4. Return array of documents with recipient info
    return Array.from(documentsMap.values()).toSorted(
      (a, b) => b.document.createdAt - a.document.createdAt
    );
  },
});

/**
 * Get the current authenticated user's recipient record for a document
 * Returns null if the user is not a recipient on this document
 * Used for in-app signing when the user is both authenticated and a recipient
 */
export const getRecipientByAuthenticatedUser = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    // 1. Get user email
    const user = await ctx.db.get("users", userId);
    if (!user || !user.email) {
      return null;
    }

    const userEmail = user.email.toLowerCase();

    // 2. Find recipient by document + email match
    let recipient = null;
    for await (const row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      if (row.email === userEmail) {
        recipient = row;
        break;
      }
    }

    if (!recipient) {
      return null;
    }

    // 3. Get the document to verify it exists and check workflow status
    const document = await ctx.db.get("documents", args.documentId);
    if (!document || document.status === "deleted") {
      return null;
    }

    // 4. Return recipient with document workflow status for client-side logic
    return {
      _id: recipient._id,
      documentId: recipient.documentId,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      status: recipient.status,
      order: recipient.order,
      viewedAt: recipient.viewedAt,
      signedAt: recipient.signedAt,
      approvedAt: recipient.approvedAt,
      declinedAt: recipient.declinedAt,
      createdAt: recipient.createdAt,
      signatureData: recipient.signatureData,
      signatureType: recipient.signatureType,
      // Include document workflow status so client can determine if signing is allowed
      documentWorkflowStatus: document.workflowStatus,
    };
  },
});

/**
 * Internal query to get document recipients without access control
 * Used by actions that need to access recipients
 */
import { internalQuery } from "../_generated/server";

export const getDocumentRecipientsInternal = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const recipients = [];
    for await (const row of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))) {
      recipients.push(row);
    }
    return recipients;
  },
});

/**
 * Internal query to find a recipient by signing token.
 * Used by actions that authenticate via signing token instead of user auth.
 */
export const findRecipientByTokenInternal = internalQuery({
  args: { signingToken: v.string() },
  handler: async (ctx, args) => {
    return await findRecipientByToken(ctx, args.signingToken);
  },
});

export const getRecipientInternal = internalQuery({
  args: { recipientId: v.id("document_recipients") },
  handler: async (ctx, args) => {
    return await ctx.db.get("document_recipients", args.recipientId);
  },
});
