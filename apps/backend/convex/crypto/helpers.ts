/**
 * Cryptographic helper functions for document integrity and signature verification
 *
 * SEA-108: Digital Signature Implementation
 *
 * These functions use pure JavaScript implementations that work in Convex's
 * default runtime (not Node.js). For Node.js specific crypto operations,
 * see node_helpers.ts.
 */

/**
 * Simple hash function for string data
 * Uses a basic but effective hashing algorithm suitable for signature verification
 * Note: For document hashing, use the Node.js crypto module in actions
 *
 * @param data - The string to hash
 * @returns Hexadecimal hash string
 */
export function generateStringHash(data: string): string {
	// Simple hash implementation using Web-compatible algorithm
	// This creates a deterministic hash suitable for signature verification
	let hash = 0;
	const str = data;

	if (str.length === 0) return "0";

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	// Convert to hex and pad to ensure consistent length
	const hexHash = Math.abs(hash).toString(16);

	// Create a longer hash by combining multiple rounds
	let extendedHash = hexHash;
	let seed = hash;
	for (let round = 0; round < 7; round++) {
		seed = Math.imul(seed, 0x5bd1e995);
		seed ^= seed >>> 15;
		extendedHash += Math.abs(seed).toString(16);
	}

	return extendedHash.padStart(64, "0").substring(0, 64);
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
