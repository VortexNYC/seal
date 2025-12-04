/**
 * PDF Signing Action
 *
 * Embeds signature images and data into PDFs and creates signed versions.
 * The cryptographic integrity is maintained through signature hashes stored
 * in the database (see signatures schema).
 *
 * SEA-108: Digital Signature Implementation
 *
 * Note: Full PDF/A digital signatures with embedded certificates require
 * additional setup (certificate authority, HSM integration). For now, we
 * embed signature images and maintain cryptographic hashes in the database.
 */

import { ConvexError, v } from "convex/values";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";

/**
 * Embed signature images and data into a PDF
 * Creates a "signed" PDF with all signatures rendered as images
 */
export const signPdfDocument = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ success: boolean; signedStorageId: string }> => {
		// 1. Get document
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{ documentId: args.documentId },
		);

		if (!document) {
			throw new ConvexError("Document not found");
		}

		// 2. Get all signatures for this document
		const signatures: Doc<"signatures">[] = await ctx.runQuery(
			internal.signatures.queries.getSignaturesByDocumentInternal,
			{ documentId: args.documentId },
		);

		if (signatures.length === 0) {
			throw new ConvexError("No signatures found for this document");
		}

		// 3. Get the original PDF
		const pdfUrl = await ctx.storage.getUrl(document.storageId);
		if (!pdfUrl) {
			throw new ConvexError("PDF file not found in storage");
		}

		const response = await fetch(pdfUrl);
		if (!response.ok) {
			throw new ConvexError("Failed to download PDF");
		}

		const pdfBuffer = await response.arrayBuffer();

		// 4. Load PDF and embed signature images
		const pdfDoc = await PDFDocument.load(pdfBuffer);
		const pages = pdfDoc.getPages();

		// Get signature fields to know where to place signatures
		const signatureFields: Doc<"signature_fields">[] = await ctx.runQuery(
			internal.signature_fields.queries.getFieldsByDocumentInternal,
			{ documentId: args.documentId },
		);

		// Get recipients for name labels
		const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
			internal.documents.recipients_queries.getDocumentRecipientsInternal,
			{ documentId: args.documentId },
		);

		const recipientMap = new Map(recipients.map((r) => [r._id, r]));

		// Embed fonts for text rendering
		const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

		// Embed each signature image into the PDF
		for (const signature of signatures) {
			// Find the field for this signature
			const field = signatureFields.find((f) => f._id === signature.fieldId);
			if (!field) continue;

			// Get the page
			const page = pages[field.page - 1];
			if (!page) continue;

			const { width: pageWidth, height: pageHeight } = page.getSize();

			// Convert percentage coordinates to PDF coordinates
			const x = (field.x / 100) * pageWidth;
			const y = (field.y / 100) * pageHeight;
			const width = (field.width / 100) * pageWidth;
			const height = (field.height / 100) * pageHeight;
			const pdfY = pageHeight - y - height;

			// Draw a light background for the signature area
			page.drawRectangle({
				x,
				y: pdfY,
				width,
				height,
				color: rgb(0.98, 0.98, 0.98),
				borderColor: rgb(0.8, 0.8, 0.8),
				borderWidth: 0.5,
			});

			// If there's a signature image URL, embed it
			if (signature.signatureImageUrl) {
				try {
					// Handle base64 data URLs
					if (signature.signatureImageUrl.startsWith("data:image/")) {
						const base64Data = signature.signatureImageUrl.split(",")[1];
						if (base64Data) {
							const imgBytes = Uint8Array.from(atob(base64Data), (c) =>
								c.charCodeAt(0),
							);

							const embeddedImage = signature.signatureImageUrl.includes(
								"data:image/png",
							)
								? await pdfDoc.embedPng(imgBytes)
								: await (async () => {
										try {
											return await pdfDoc.embedJpg(imgBytes);
										} catch {
											// Fallback to PNG
											return await pdfDoc.embedPng(imgBytes);
										}
									})();

							// Calculate dimensions to fit while maintaining aspect ratio
							const imgDims = embeddedImage.scaleToFit(width - 10, height - 20);

							// Center the image in the field (leave room for info text below)
							const imgX = x + (width - imgDims.width) / 2;
							const imgY = pdfY + 15 + (height - 15 - imgDims.height) / 2;

							// Draw the signature image
							page.drawImage(embeddedImage, {
								x: imgX,
								y: imgY,
								width: imgDims.width,
								height: imgDims.height,
							});
						}
					} else {
						// Fetch from URL
						const imgResponse = await fetch(signature.signatureImageUrl);
						if (imgResponse.ok) {
							const imgBuffer = await imgResponse.arrayBuffer();
							const imgBytes = new Uint8Array(imgBuffer);

							const contentType = imgResponse.headers.get("content-type") || "";
							const embeddedImage = contentType.includes("png")
								? await pdfDoc.embedPng(imgBytes)
								: await (async () => {
										try {
											return await pdfDoc.embedJpg(imgBytes);
										} catch {
											return await pdfDoc.embedPng(imgBytes);
										}
									})();

							const imgDims = embeddedImage.scaleToFit(width - 10, height - 20);
							const imgX = x + (width - imgDims.width) / 2;
							const imgY = pdfY + 15 + (height - 15 - imgDims.height) / 2;

							page.drawImage(embeddedImage, {
								x: imgX,
								y: imgY,
								width: imgDims.width,
								height: imgDims.height,
							});
						}
					}
				} catch (error) {
					console.error("Failed to embed signature image:", error);
					// Continue - we'll show typed signature below if available
				}
			}

			// For typed signatures or as fallback, draw the text
			if (signature.value && !signature.signatureImageUrl) {
				const fontSize = Math.min(height * 0.4, 20);
				const textWidth = helveticaBold.widthOfTextAtSize(
					signature.value,
					fontSize,
				);

				// Center the text
				const textX = x + (width - textWidth) / 2;
				const textY = pdfY + height / 2 - fontSize / 3;

				page.drawText(signature.value, {
					x: textX,
					y: textY,
					size: fontSize,
					font: helveticaBold,
					color: rgb(0.1, 0.1, 0.3),
				});
			}

			// Add signer info at the bottom of the signature field
			const recipient = recipientMap.get(
				signature.recipientId as Id<"document_recipients">,
			);
			if (recipient) {
				const signerName = recipient.name || recipient.email;
				const signDate = new Date(signature.signedAt).toLocaleDateString(
					"en-US",
					{
						year: "numeric",
						month: "short",
						day: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					},
				);

				const infoFontSize = 7;
				const infoText = `${signerName} - ${signDate}`;

				page.drawText(infoText, {
					x: x + 3,
					y: pdfY + 3,
					size: infoFontSize,
					font: helvetica,
					color: rgb(0.4, 0.4, 0.4),
				});
			}
		}

		// 5. Add verification footer to the last page
		const lastPage = pages[pages.length - 1];
		if (lastPage) {
			const { width: pageWidth } = lastPage.getSize();
			const footerY = 20;

			// Draw a line
			lastPage.drawLine({
				start: { x: 50, y: footerY + 15 },
				end: { x: pageWidth - 50, y: footerY + 15 },
				thickness: 0.5,
				color: rgb(0.8, 0.8, 0.8),
			});

			// Add verification text
			const verificationText = `Document signed via Seal | Signatures: ${signatures.length} | Document Hash: ${document.documentHash?.substring(0, 16) || "N/A"}...`;
			const textWidth = helvetica.widthOfTextAtSize(verificationText, 8);

			lastPage.drawText(verificationText, {
				x: (pageWidth - textWidth) / 2,
				y: footerY,
				size: 8,
				font: helvetica,
				color: rgb(0.5, 0.5, 0.5),
			});
		}

		// 6. Save the signed PDF
		const signedPdfBytes = await pdfDoc.save();

		// 7. Store the signed PDF
		const signedBlob = new Blob([signedPdfBytes as BlobPart], {
			type: "application/pdf",
		});
		const signedStorageId = await ctx.storage.store(signedBlob);

		// 8. Update the document with the signed PDF reference
		await ctx.runMutation(internal.documents.mutations.updateSignedStorageId, {
			documentId: args.documentId,
			signedStorageId,
		});

		return { success: true, signedStorageId };
	},
});

/**
 * Get URL for the signed PDF
 */
export const getSignedPdfUrl = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<string | null> => {
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{ documentId: args.documentId },
		);

		if (!document || !document.signedStorageId) {
			return null;
		}

		const url = await ctx.storage.getUrl(document.signedStorageId);
		return url;
	},
});

/**
 * Get both original and signed PDF URLs
 */
export const getDocumentPdfUrls = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		originalUrl: string | null;
		signedUrl: string | null;
		hasSignedVersion: boolean;
		documentName: string;
	}> => {
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{ documentId: args.documentId },
		);

		if (!document) {
			throw new ConvexError("Document not found");
		}

		const originalUrl = await ctx.storage.getUrl(document.storageId);
		const signedUrl = document.signedStorageId
			? await ctx.storage.getUrl(document.signedStorageId)
			: null;

		return {
			originalUrl,
			signedUrl,
			hasSignedVersion: !!document.signedStorageId,
			documentName: document.name,
		};
	},
});

/**
 * Check if a document has been signed (has signatures)
 */
export const checkDocumentSigningStatus = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		hasSignatures: boolean;
		signatureCount: number;
		hasSignedPdf: boolean;
		documentHash: string | null;
	}> => {
		const document: Doc<"documents"> | null = await ctx.runQuery(
			internal.documents.queries.getDocumentInternal,
			{ documentId: args.documentId },
		);

		if (!document) {
			throw new ConvexError("Document not found");
		}

		const signatures: Doc<"signatures">[] = await ctx.runQuery(
			internal.signatures.queries.getSignaturesByDocumentInternal,
			{ documentId: args.documentId },
		);

		return {
			hasSignatures: signatures.length > 0,
			signatureCount: signatures.length,
			hasSignedPdf: !!document.signedStorageId,
			documentHash: document.documentHash ?? null,
		};
	},
});
