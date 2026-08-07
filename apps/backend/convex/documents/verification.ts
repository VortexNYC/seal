/**
 * Public Document Verification
 *
 * No authentication required — the qrToken acts as a capability token.
 * Returns only public-safe data (no IDs, masked emails, no file access).
 */

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if (local.length <= 1) return `*${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}${domain}`;
}

type PublicSigner = {
  name: string;
  maskedEmail: string;
  role: Doc<"document_recipients">["role"];
  signedAt: number | null;
};

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

    const signers: PublicSigner[] = [];

    for await (const r of ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", document._id))) {
      if (r.status !== "signed" && r.status !== "approved") {
        continue;
      }
      signers.push({
        name: r.name ?? r.email,
        maskedEmail: maskEmail(r.email),
        role: r.role,
        signedAt: r.signedAt ?? r.approvedAt ?? null,
      });
    }

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
