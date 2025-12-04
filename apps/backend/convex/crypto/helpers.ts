/**
 * Cryptographic helper functions for document integrity and signature verification
 *
 * SEA-108: Digital Signature Implementation
 *
 * Uses Web Crypto API for all cryptographic operations to ensure
 * compliance with modern security standards.
 */

import { createHash } from "node:crypto";

/**
 * Generate SHA-256 hash of a buffer
 * @param data - The data to hash (ArrayBuffer or Uint8Array)
 * @returns Hexadecimal hash string
 */
export function generateSHA256Hash(data: ArrayBuffer | Uint8Array): string {
	const hash = createHash("sha256");
	// Convert ArrayBuffer to Uint8Array if needed, then to Buffer
	const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
	hash.update(Buffer.from(bytes));
	return hash.digest("hex");
}

/**
 * Generate SHA-256 hash of a string
 * @param data - The string to hash
 * @returns Hexadecimal hash string
 */
export function generateStringHash(data: string): string {
	const hash = createHash("sha256");
	hash.update(data, "utf8");
	return hash.digest("hex");
}

/**
 * Generate a signature hash from signature data
 * Combines signature content with metadata for tamper detection
 *
 * @param signatureData - The signature value or image data
 * @param recipientId - The recipient who signed
 * @param fieldId - The field being signed
 * @param documentHash - The document hash at time of signing
 * @param timestamp - The signing timestamp
 * @returns Hexadecimal hash string
 */
export function generateSignatureHash(
	signatureData: string,
	recipientId: string,
	fieldId: string,
	documentHash: string,
	timestamp: number,
): string {
	const dataToHash = [
		signatureData,
		recipientId,
		fieldId,
		documentHash,
		timestamp.toString(),
	].join("|");

	return generateStringHash(dataToHash);
}

/**
 * Verify a signature hash
 * Recalculates the hash and compares with stored hash
 *
 * @param signatureData - The signature value or image data
 * @param recipientId - The recipient who signed
 * @param fieldId - The field being signed
 * @param documentHash - The document hash at time of signing
 * @param timestamp - The signing timestamp
 * @param storedHash - The stored signature hash to verify against
 * @returns True if hash matches, false otherwise
 */
export function verifySignatureHash(
	signatureData: string,
	recipientId: string,
	fieldId: string,
	documentHash: string,
	timestamp: number,
	storedHash: string,
): boolean {
	const calculatedHash = generateSignatureHash(
		signatureData,
		recipientId,
		fieldId,
		documentHash,
		timestamp,
	);
	return calculatedHash === storedHash;
}

/**
 * Verify document integrity by comparing hashes
 *
 * @param currentHash - Current document hash
 * @param originalHash - Original document hash stored at upload
 * @returns True if document has not been tampered with
 */
export function verifyDocumentIntegrity(
	currentHash: string,
	originalHash: string,
): boolean {
	return currentHash === originalHash;
}

/**
 * Generate a certificate-like object for a signature
 * This provides a structured record for audit and compliance purposes
 *
 * @param signature - Signature record from database
 * @param recipient - Recipient record from database
 * @param document - Document record from database
 * @returns Signature certificate object
 */
export function generateSignatureCertificate(
	signature: {
		signatureHash?: string | null;
		documentHashAtSigning?: string | null;
		signedAt: number;
		ipAddress: string;
		userAgent: string;
		signatureMethod?: string | null;
	},
	recipient: {
		name?: string | null;
		email: string;
	},
	document: {
		name: string;
		documentHash?: string | null;
	},
): {
	certificateVersion: string;
	documentName: string;
	documentHash: string | null;
	signerName: string | null;
	signerEmail: string;
	signedAt: string;
	signatureHash: string | null;
	documentHashAtSigning: string | null;
	signatureMethod: string | null;
	ipAddress: string;
	userAgent: string;
	integrityVerified: boolean;
} {
	const integrityVerified =
		document.documentHash != null &&
		signature.documentHashAtSigning != null &&
		document.documentHash === signature.documentHashAtSigning;

	return {
		certificateVersion: "1.0",
		documentName: document.name,
		documentHash: document.documentHash ?? null,
		signerName: recipient.name ?? null,
		signerEmail: recipient.email,
		signedAt: new Date(signature.signedAt).toISOString(),
		signatureHash: signature.signatureHash ?? null,
		documentHashAtSigning: signature.documentHashAtSigning ?? null,
		signatureMethod: signature.signatureMethod ?? null,
		ipAddress: signature.ipAddress,
		userAgent: signature.userAgent,
		integrityVerified,
	};
}
