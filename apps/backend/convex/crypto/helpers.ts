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
 * Generate SHA-256 hash of a string using Web Crypto API
 * Works in Convex's V8 runtime (no Node.js required)
 *
 * @param data - The string to hash
 * @returns Hexadecimal hash string (64 characters)
 */
export async function generateStringHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
export async function generateSignatureHash(
  signatureData: string,
  recipientId: string,
  fieldId: string,
  documentHash: string,
  timestamp: number,
): Promise<string> {
  const dataToHash = [signatureData, recipientId, fieldId, documentHash, timestamp.toString()].join(
    "|",
  );

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
export async function verifySignatureHash(
  signatureData: string,
  recipientId: string,
  fieldId: string,
  documentHash: string,
  timestamp: number,
  storedHash: string,
): Promise<boolean> {
  const calculatedHash = await generateSignatureHash(
    signatureData,
    recipientId,
    fieldId,
    documentHash,
    timestamp,
  );
  return calculatedHash === storedHash;
}

/**
 * Generate a SHA-256 hash of signature image data for reuse detection.
 * This hashes only the raw image content (stripping the data URL prefix if present),
 * allowing detection of the same signature image across different documents.
 *
 * @param imageData - The signature image data (base64 data URL or raw base64)
 * @returns Hexadecimal hash string, or undefined if no image data
 */
export async function generateSignatureImageHash(
  imageData: string | undefined,
): Promise<string | undefined> {
  if (!imageData) return undefined;

  // Strip data URL prefix (e.g., "data:image/png;base64,") to hash only the raw image bytes
  const rawData = imageData.includes(",") ? imageData.split(",")[1] ?? imageData : imageData;

  return generateStringHash(rawData);
}

/**
 * Verify document integrity by comparing hashes
 *
 * @param currentHash - Current document hash
 * @param originalHash - Original document hash stored at upload
 * @returns True if document has not been tampered with
 */
export function verifyDocumentIntegrity(currentHash: string, originalHash: string): boolean {
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
    document.documentHash !== null &&
    signature.documentHashAtSigning !== null &&
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
