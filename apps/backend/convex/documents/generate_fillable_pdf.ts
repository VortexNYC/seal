import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { generateFillablePdf } from "./pdf_form_generator";

/**
 * Action to generate a fillable PDF with form fields based on signature fields
 * This runs on the Convex backend and returns the PDF as a Uint8Array
 */
export const generateFillablePdfAction = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ pdfBase64: string; fileName: string }> => {
		// Get document using internal query
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{
				documentId: args.documentId,
			},
		);

		if (!document) {
			throw new ConvexError("Document not found");
		}

		// Get signature fields for this document
		const signatureFields: Doc<"signature_fields">[] = await ctx.runQuery(
			internal.signature_fields.queries.getFieldsByDocumentInternal,
			{
				documentId: args.documentId,
			},
		);

		// Get recipients for this document
		const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
			internal.documents.recipients_queries.getDocumentRecipientsInternal,
			{
				documentId: args.documentId,
			},
		);

		// Create a map of recipient IDs to recipient info
		const recipientMap = new Map(
			recipients.map((r) => [r._id, { name: r.name ?? null, email: r.email }]),
		);

		// Fetch the original PDF file from storage
		const pdfUrl = await ctx.storage.getUrl(document.storageId);
		if (!pdfUrl) {
			throw new Error("PDF file not found in storage");
		}

		// Download the PDF
		const response = await fetch(pdfUrl);
		if (!response.ok) {
			throw new Error("Failed to download PDF");
		}

		const pdfArrayBuffer = await response.arrayBuffer();

		// Generate fillable PDF with form fields
		const fillablePdfBytes = await generateFillablePdf(
			pdfArrayBuffer,
			signatureFields,
			recipientMap,
		);

		// Convert Uint8Array to base64 for transmission
		const base64Pdf = Buffer.from(fillablePdfBytes).toString("base64");

		return {
			pdfBase64: base64Pdf,
			fileName: `${document.name}_fillable.pdf`,
		};
	},
});
