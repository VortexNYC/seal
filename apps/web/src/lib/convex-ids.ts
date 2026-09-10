/**
 * Lightweight identity helpers for Vortex document/recipient/field ids.
 *
 * These used to brand strings as Convex `Id<TableName>` values. The web app now
 * treats ids as plain strings, so `parseId` is retained only for source-
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
