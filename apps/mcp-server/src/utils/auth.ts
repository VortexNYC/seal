/**
 * @fileoverview Authentication utilities for the Seal MCP server.
 */

/**
 * Type for the extra parameter passed to MCP tool/resource handlers.
 */
export type McpRequestExtra = {
	authInfo?: { token: string };
};

/**
 * Extracts the auth token from MCP request extra data.
 * Returns undefined if no valid token is present.
 */
export function getAuthToken(extra: McpRequestExtra): string | undefined {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
}
