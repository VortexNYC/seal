/**
 * Cryptographic utilities for digital signatures and document integrity
 *
 * SEA-108: Digital Signature Implementation
 *
 * Note: This module has two parts:
 * - helpers.ts: Pure JavaScript functions for use in queries/mutations
 * - node_helpers.ts: Node.js crypto functions for use in actions only
 */

// Pure JavaScript helpers (work in Convex default runtime)
export {
	generateSignatureCertificate,
	generateSignatureHash,
	generateStringHash,
	verifyDocumentIntegrity,
	verifySignatureHash,
} from "./helpers";

// Node.js helpers are exported from node_helpers.ts directly
// Import them with: import { generateSHA256Hash } from "../crypto/node_helpers";
