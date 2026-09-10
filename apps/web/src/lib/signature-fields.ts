import { type Doc } from "@/lib/convex-ids";

/**
 * Counts only true signature fields, excluding other fillable field types.
 *
 * @param fields - The list of signature field documents to filter.
 * @returns The number of fields whose `fieldType` is `"signature"`.
 */
export function countSignatureFields(
  fields: Array<Doc<"signature_fields">>
): number {
  return fields.filter((field) => field.fieldType === "signature").length;
}
