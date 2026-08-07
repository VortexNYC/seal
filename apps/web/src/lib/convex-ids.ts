import type { Id, TableNames } from "@seal/backend/convex/_generated/dataModel";
import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";

/**
 * Brand a runtime string as a typed Convex document id without a type
 * assertion. Validation is Core's `parse` over `v.id`, so the narrowing is
 * performed by a validator rather than an `as` cast.
 */
export function parseId<TableName extends TableNames | "_storage">(
  table: TableName,
  value: string
): Id<TableName> {
  return parse(v.id(table), value);
}
