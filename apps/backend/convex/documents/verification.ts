/**
 * Public Document Verification
 *
 * No authentication required — the qrToken acts as a capability token.
 * Returns only public-safe data (no IDs, masked emails, no file access).
 */

import { v } from "convex/values";

import { query } from "../_generated/server";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}${domain}`;
}

export const getDocumentByQrToken = query({
  args: { qrToken: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_qr_token", (q) => q.eq("qrToken", args.qrToken))
      .unique();

    if (!document || document.workflowStatus !== "completed") {
      return null;
    }

    const allRecipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", document._id))
      .collect();

    const signers = allRecipients
      .filter((r) => r.status === "signed" || r.status === "approved")
      .map((r) => ({
        name: r.name ?? r.email,
        maskedEmail: maskEmail(r.email),
        role: r.role,
        signedAt: r.signedAt ?? r.approvedAt ?? null,
      }));

    return {
      verified: true,
      documentName: document.name,
      completedAt: document.completedAt ?? null,
      signerCount: signers.length,
      signers,
      documentHash: document.documentHash ?? null,
      createdAt: document._creationTime,
    };
  },
});
