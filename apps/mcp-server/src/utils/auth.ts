/**
 * @fileoverview Authentication utilities for the Seal MCP server.
 */
import { logger } from "./logger";

/**
 * Type for the extra parameter passed to MCP tool/resource handlers.
 */
export type McpRequestExtra = {
	authInfo?: { token: string; extra?: { userId?: string } };
};

/**
 * Extracts the auth token from MCP request extra data.
 * Returns undefined if no valid token is present.
 */
export function getAuthToken(extra: McpRequestExtra): string | undefined {
	// Debug logging to understand auth flow
	logger.debug(
		`[getAuthToken] extra keys: ${extra ? Object.keys(extra).join(", ") : "none"}`,
	);
	logger.debug(
		`[getAuthToken] authInfo: ${extra?.authInfo ? JSON.stringify({ hasToken: !!extra.authInfo.token, extra: extra.authInfo.extra }) : "none"}`,
	);

	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
}
