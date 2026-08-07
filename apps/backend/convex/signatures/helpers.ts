import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Signature Helper Functions
 *
 * Utilities for signature validation and verification.
 *
 * SEA-31: Database Schemas - Signatures Implementation
 */

/**
 * Validate signature data based on field type
 */
export function validateSignature(
  fieldType: string,
  value?: string,
  signatureImageUrl?: string
): { valid: boolean; error?: string } {
  // Signature fields must have an image URL
  if (fieldType === "signature" || fieldType === "initial") {
    if (!signatureImageUrl) {
      return {
        valid: false,
        error: "Signature fields must have an image URL",
      };
    }
    return { valid: true };
  }

  // Text, date, and other fields must have a value
  if (fieldType === "text" || fieldType === "date") {
    if (!value || value.trim() === "") {
      return { valid: false, error: `${fieldType} field cannot be empty` };
    }
    return { valid: true };
  }

  // Checkbox can be empty (unchecked)
  if (fieldType === "checkbox") {
    return { valid: true };
  }

  // Dropdown and radio must have a value
  if (fieldType === "dropdown" || fieldType === "radio") {
    if (!value || value.trim() === "") {
      return {
        valid: false,
        error: `${fieldType} field must have a selection`,
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Check if a field has been completed (has a valid signature)
 */
export async function checkFieldCompleted(
  ctx: QueryCtx,
  fieldId: Id<"signature_fields">
): Promise<boolean> {
  const signature = await ctx.db
    .query("signatures")
    .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
    .first();

  return signature !== null;
}

/**
 * Validate signature against field validation rules
 */
export function validateAgainstRules(
  value: string | undefined,
  validationRules?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  }
): { valid: boolean; error?: string } {
  if (!validationRules) {
    return { valid: true };
  }

  const firstError =
    getRequiredRuleError(value, validationRules) ??
    getMinRuleError(value, validationRules) ??
    getMaxRuleError(value, validationRules) ??
    getPatternRuleError(value, validationRules);
  if (firstError) {
    return { valid: false, error: firstError };
  }

  if (!value) {
    return { valid: true };
  }

  return { valid: true };
}

function getValidationErrorMessage(
  validationRules: NonNullable<Parameters<typeof validateAgainstRules>[1]>,
  fallback: string
): string {
  return validationRules.customMessage || fallback;
}

function getRequiredRuleError(
  value: string | undefined,
  validationRules: NonNullable<Parameters<typeof validateAgainstRules>[1]>
): string | undefined {
  if (!validationRules.required || (value && value.trim() !== "")) {
    return undefined;
  }

  return getValidationErrorMessage(validationRules, "This field is required");
}

function getMinRuleError(
  value: string | undefined,
  validationRules: NonNullable<Parameters<typeof validateAgainstRules>[1]>
): string | undefined {
  if (
    !value ||
    validationRules.min === undefined ||
    value.length >= validationRules.min
  ) {
    return undefined;
  }

  return getValidationErrorMessage(
    validationRules,
    `Minimum length is ${validationRules.min} characters`
  );
}

function getMaxRuleError(
  value: string | undefined,
  validationRules: NonNullable<Parameters<typeof validateAgainstRules>[1]>
): string | undefined {
  if (
    !value ||
    validationRules.max === undefined ||
    value.length <= validationRules.max
  ) {
    return undefined;
  }

  return getValidationErrorMessage(
    validationRules,
    `Maximum length is ${validationRules.max} characters`
  );
}

function getPatternRuleError(
  value: string | undefined,
  validationRules: NonNullable<Parameters<typeof validateAgainstRules>[1]>
): string | undefined {
  if (
    !value ||
    !validationRules.pattern ||
    new RegExp(validationRules.pattern).test(value)
  ) {
    return undefined;
  }

  return getValidationErrorMessage(
    validationRules,
    "Value does not match required pattern"
  );
}

/**
 * Get completion status for a document
 * Returns percentage and list of incomplete required fields
 */
export async function getDocumentCompletionStatus(
  ctx: QueryCtx,
  documentId: Id<"documents">
): Promise<{
  completionPercentage: number;
  totalFields: number;
  completedFields: number;
  requiredFieldsComplete: boolean;
  incompleteRequiredFields: Doc<"signature_fields">[];
}> {
  // Get all fields for the document
  const fields: Doc<"signature_fields">[] = [];
  for await (const field of ctx.db
    .query("signature_fields")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))) {
    fields.push(field);
  }

  let completedCount = 0;
  const incompleteRequiredFields: Doc<"signature_fields">[] = [];

  for (const field of fields) {
    const isCompleted = await checkFieldCompleted(ctx, field._id);

    if (isCompleted) {
      completedCount++;
    } else if (field.isRequired) {
      incompleteRequiredFields.push(field);
    }
  }

  const completionPercentage =
    fields.length > 0 ? (completedCount / fields.length) * 100 : 0;
  const requiredFieldsComplete = incompleteRequiredFields.length === 0;

  return {
    completionPercentage,
    totalFields: fields.length,
    completedFields: completedCount,
    requiredFieldsComplete,
    incompleteRequiredFields,
  };
}

/**
 * Check if a recipient has completed all their assigned fields
 */
export async function checkRecipientComplete(
  ctx: QueryCtx,
  documentId: Id<"documents">,
  recipientId: Id<"document_recipients">
): Promise<{
  complete: boolean;
  totalFields: number;
  completedFields: number;
  incompleteFields: Doc<"signature_fields">[];
}> {
  // Get all fields assigned to this recipient
  const fields: Doc<"signature_fields">[] = [];
  for await (const field of ctx.db
    .query("signature_fields")
    .withIndex("by_document_recipient", (q) =>
      q.eq("documentId", documentId).eq("recipientId", recipientId)
    )) {
    fields.push(field);
  }

  let completedCount = 0;
  const incompleteFields: Doc<"signature_fields">[] = [];

  for (const field of fields) {
    const isCompleted = await checkFieldCompleted(ctx, field._id);

    if (isCompleted) {
      completedCount++;
    } else {
      incompleteFields.push(field);
    }
  }

  return {
    complete: incompleteFields.length === 0,
    totalFields: fields.length,
    completedFields: completedCount,
    incompleteFields,
  };
}

/**
 * Verify document integrity before allowing a signature.
 *
 * Checks:
 * 1. Document has a hash (computed at upload time)
 * 2. If prior signatures exist, their `documentHashAtSigning` matches the current hash
 *    (ensures the document wasn't modified between signatures)
 *
 * Throws ConvexError if verification fails, blocking the signature.
 */
export async function verifyDocumentIntegrityForSigning(
  ctx: Pick<QueryCtx, "db">,
  document: Doc<"documents">
): Promise<void> {
  // If document has no hash yet, we can't verify integrity.
  // This shouldn't happen for documents created after the hash-on-upload feature,
  // but we allow it for backwards compatibility with older documents.
  if (!document.documentHash) {
    return;
  }

  // Check if any existing signatures were made against a different document hash.
  // This detects tampering: if the document was modified after someone signed it.
  for await (const sig of ctx.db
    .query("signatures")
    .withIndex("by_document", (q) => q.eq("documentId", document._id))) {
    if (
      sig.documentHashAtSigning &&
      sig.documentHashAtSigning !== document.documentHash
    ) {
      throw new ConvexError({
        code: "INTEGRITY_ERROR",
        message:
          "Document integrity check failed: the document has been modified since a previous signature was applied. Signing is blocked to protect all parties.",
      });
    }
  }
}
