import type { Dispute } from "../../domain/disputes";
import type { CursorPage } from "./common";

export interface DisputeListResponse extends CursorPage<Dispute> {}

export interface UploadDisputeEvidenceRequest {
  readonly fileName: string;
  readonly contentType: "application/pdf" | "image/jpeg" | "image/png";
  readonly sizeBytes: number;
}

export interface SubmitDisputeEvidenceRequest {
  readonly note: string;
  readonly amount?: number;
  readonly refund?: string;
}

export interface AcceptDisputeRequest {
  readonly note?: string;
}

export const DISPUTE_EVIDENCE_ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const DISPUTE_EVIDENCE_MAX_FILE_COUNT = 8;
export const DISPUTE_EVIDENCE_MAX_FILE_BYTES = 1_000_000;
export const DISPUTE_EVIDENCE_MAX_TOTAL_BYTES = 10_000_000;

export interface DisputeEvidencePreflightResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

export function validateDisputeEvidenceUploadBatch(
  files: readonly UploadDisputeEvidenceRequest[],
): DisputeEvidencePreflightResult {
  const errors: string[] = [];
  if (files.length === 0) {
    errors.push("at least one dispute evidence file is required");
  }
  if (files.length > DISPUTE_EVIDENCE_MAX_FILE_COUNT) {
    errors.push(`dispute evidence supports at most ${DISPUTE_EVIDENCE_MAX_FILE_COUNT} files`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalBytes > DISPUTE_EVIDENCE_MAX_TOTAL_BYTES) {
    errors.push(`dispute evidence total size must be <= ${DISPUTE_EVIDENCE_MAX_TOTAL_BYTES} bytes`);
  }
  for (const file of files) {
    if (!DISPUTE_EVIDENCE_ALLOWED_CONTENT_TYPES.includes(file.contentType)) {
      errors.push(`${file.fileName} contentType must be PDF, JPEG, or PNG`);
    }
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) {
      errors.push(`${file.fileName} sizeBytes must be a positive integer`);
    }
    if (file.sizeBytes > DISPUTE_EVIDENCE_MAX_FILE_BYTES) {
      errors.push(`${file.fileName} sizeBytes must be <= ${DISPUTE_EVIDENCE_MAX_FILE_BYTES}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
