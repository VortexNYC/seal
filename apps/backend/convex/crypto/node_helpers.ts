"use node";

/**
 * Node.js specific cryptographic helper functions
 *
 * SEA-108: Digital Signature Implementation
 *
 * These functions use Node.js crypto module and must only be used in
 * Convex actions (files with "use node" directive).
 */

import { createHash } from "node:crypto";

/**
 * Generate SHA-256 hash of a buffer using Node.js crypto
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
