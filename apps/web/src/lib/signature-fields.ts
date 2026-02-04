import type { Doc } from "@seal/backend/convex/_generated/dataModel";

/**
 * Counts only true signature fields, excluding other fillable field types.
 */
export function countSignatureFields(fields: Array<Doc<"signature_fields">>): number {
  return fields.filter((field) => field.fieldType === "signature").length;
}
