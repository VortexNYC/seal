/**
 * Resolves an MCP resource-template variable to a single string value.
 * The MCP SDK types template variables as `string | string[]`; our templates
 * always bind a single value, so take the first entry when given an array.
 */
export function resolveTemplateVariable(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}
