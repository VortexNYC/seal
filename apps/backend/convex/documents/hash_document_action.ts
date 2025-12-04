"use node";

/**
 * Action to compute and store document hash for integrity verification
 *
 * SEA-108: Digital Signature Implementation
 *
 * This action downloads the PDF from storage, computes its SHA-256 hash,
 * and stores the hash in the document record for later verification.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { generateSHA256Hash } from "../crypto/node_helpers";

/**
 * Compute and store the SHA-256 hash of a document
 * Should be called after document upload to establish integrity baseline
 */
export const hashDocument = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args): Promise<{ hash: string }> => {
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

		// If document already has a hash, return it
		if (document.documentHash) {
			return { hash: document.documentHash };
		}

		// Fetch the original PDF file from storage
		const pdfUrl = await ctx.storage.getUrl(document.storageId);
		if (!pdfUrl) {
			throw new ConvexError("PDF file not found in storage");
		}

		// Download the PDF
		const response = await fetch(pdfUrl);
		if (!response.ok) {
			throw new ConvexError("Failed to download PDF for hashing");
		}

		const pdfArrayBuffer = await response.arrayBuffer();

		// Generate SHA-256 hash
		const hash = generateSHA256Hash(pdfArrayBuffer);

		// Store the hash in the document record
		await ctx.runMutation(internal.documents.mutations.updateDocumentHash, {
			documentId: args.documentId,
			documentHash: hash,
		});

		return { hash };
	},
});

/**
 * Verify document integrity by comparing current hash with stored hash
 */
export const verifyDocumentIntegrity = action({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		isValid: boolean;
		storedHash: string | null;
		currentHash: string;
		message: string;
	}> => {
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

		// Fetch the original PDF file from storage
		const pdfUrl = await ctx.storage.getUrl(document.storageId);
		if (!pdfUrl) {
			throw new ConvexError("PDF file not found in storage");
		}

		// Download the PDF
		const response = await fetch(pdfUrl);
		if (!response.ok) {
			throw new ConvexError("Failed to download PDF for verification");
		}

		const pdfArrayBuffer = await response.arrayBuffer();

		// Generate current hash
		const currentHash = generateSHA256Hash(pdfArrayBuffer);

		// Compare with stored hash
		if (!document.documentHash) {
			return {
				isValid: false,
				storedHash: null,
				currentHash,
				message:
					"Document has no stored hash. Call hashDocument first to establish baseline.",
			};
		}

		const isValid = currentHash === document.documentHash;

		return {
			isValid,
			storedHash: document.documentHash,
			currentHash,
			message: isValid
				? "Document integrity verified. No tampering detected."
				: "Document integrity check FAILED. The document may have been modified.",
		};
	},
});
