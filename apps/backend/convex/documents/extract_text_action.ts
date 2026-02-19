"use node";

/**
 * Action to extract text content from a PDF for search indexing.
 *
 * Downloads the PDF from Convex storage, uses unpdf (serverless-compatible
 * pdfjs wrapper) to extract text from every page, and stores the concatenated
 * result on the document. Scheduled automatically after document upload.
 */

import { ConvexError, v } from "convex/values";
import { extractText } from "unpdf";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";

const MAX_TEXT_LENGTH = 100_000;

export const extractDocumentText = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ charCount: number }> => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId },
    );

    if (!document) {
      throw new ConvexError("Document not found");
    }

    if (document.extractedText) {
      return { charCount: document.extractedText.length };
    }

    const pdfUrl = await ctx.storage.getUrl(document.storageId);
    if (!pdfUrl) {
      throw new ConvexError("PDF file not found in storage");
    }

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new ConvexError("Failed to download PDF for text extraction");
    }

    const pdfArrayBuffer = await response.arrayBuffer();
    const pdfData = new Uint8Array(pdfArrayBuffer);

    const { text } = await extractText(pdfData, { mergePages: true });

    let extractedText = typeof text === "string" ? text : "";

    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH);
    }

    await ctx.runMutation(internal.documents.mutations.updateExtractedText, {
      documentId: args.documentId,
      extractedText,
    });

    return { charCount: extractedText.length };
  },
});
