/**
 * Lightweight identity helpers for Seal document/recipient/field ids.
 *
 * Ids are treated as plain strings. `parseId` is retained for source
 * compatibility and returns its input unchanged.
 */

export type Id<_TableName extends string = string> = string;

export type Doc<_TableName extends string = string> = Record<string, unknown>;

export function parseId<_TableName extends string>(
  _table: _TableName,
  value: string
): Id<_TableName> {
  return value;
}
