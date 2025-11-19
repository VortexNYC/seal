import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { generateFillablePdf } from "./pdf_form_generator";

/**
 * Action to generate a fillable PDF with form fields based on signature fields
 * This runs on the Convex backend and returns the PDF as a Uint8Array
 */
export const generateFillablePdfAction = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		// Get document
		const document = await ctx.runQuery(api.documents.queries.get, {
			id: args.documentId,
		});

		if (!document) {
			throw new Error("Document not found");
		}

		// Get signature fields for this document
		const signatureFields = await ctx.runQuery(
			api.signature_fields.queries.getFieldsByDocument,
			{
				documentId: args.documentId,
			},
		);

		// Get recipients for this document
		const recipients = await ctx.runQuery(
			api.documents.recipients_queries.getDocumentRecipients,
			{
				documentId: args.documentId,
			},
		);

		// Create a map of recipient IDs to recipient info
		const recipientMap = new Map(
			recipients.map((r) => [r._id, { name: r.name, email: r.email }]),
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
			document.name,
		);

		// Convert Uint8Array to base64 for transmission
		const base64Pdf = Buffer.from(fillablePdfBytes).toString("base64");

		return {
			pdfBase64: base64Pdf,
			fileName: `${document.name}_fillable.pdf`,
		};
	},
});
