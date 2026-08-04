"use node";

/**
 * Gemini OCR fallback for scanned PDFs.
 *
 * When unpdf extracts no text (image-only/scanned PDFs), this action sends
 * the PDF to Gemini to OCR the content. The extracted text is saved on the
 * document so search indexing can proceed normally.
 *
 * Only called by the pipeline when extractedText is empty — most PDFs have
 * embedded text and never hit this path.
 */

import { generateText } from "ai";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { getModel } from "./model";

/** Max text length to store (same as unpdf extraction). */
const MAX_TEXT_LENGTH = 100_000;

const OCR_PROMPT = `Extract ALL text from this PDF document. This appears to be a scanned document with text in images rather than embedded text.

## Instructions
1. Read every page and extract all visible text
2. Preserve the reading order (left-to-right, top-to-bottom)
3. Separate pages with a form feed character (\\f)
4. Preserve paragraph breaks as double newlines
5. Do NOT add commentary, headers, or formatting — just the raw text as it appears
6. If a page has no readable text, output a single form feed for that page boundary

Return ONLY the extracted text, nothing else.`;

export const ocrExtractText = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ charCount: number; tokensUsed: number; durationMs: number }> => {
    const document = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      {
        documentId: args.documentId,
      }
    );
    if (!document) throw new Error("Document not found");

    // Download PDF
    const pdfUrl = await ctx.storage.getUrl(
      document.storageId as Id<"_storage">
    );
    if (!pdfUrl) throw new Error("PDF not found in storage");

    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error("Failed to download PDF");
    const pdfBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(pdfBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const pdfBase64 = btoa(binary);

    // Ask Gemini to OCR the document
    const startTime = Date.now();
    const result = await generateText({
      model: getModel("google/gemini-3-flash"),
      messages: [
        {
          role: "user",
          content: [
            { type: "file", data: pdfBase64, mediaType: "application/pdf" },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
    });
    const durationMs = Date.now() - startTime;
    const tokensUsed = result.usage?.totalTokens ?? 0;

    let extractedText = result.text.trim();

    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH);
    }

    if (extractedText.length === 0) {
      console.warn(
        `[OCR Fallback] Gemini returned no text for ${args.documentId}`
      );
      return { charCount: 0, tokensUsed, durationMs };
    }

    // Save via the same mutation unpdf uses
    await ctx.runMutation(internal.documents.mutations.updateExtractedText, {
      documentId: args.documentId,
      extractedText,
    });

    console.info(
      `[OCR Fallback] Extracted ${extractedText.length} chars from scanned PDF ${args.documentId}`
    );

    return { charCount: extractedText.length, tokensUsed, durationMs };
  },
});
