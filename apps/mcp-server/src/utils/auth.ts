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
  logger.info(
    `[getAuthToken] extra type: ${typeof extra}, keys: ${extra ? Object.keys(extra).join(", ") : "none"}`,
  );
  logger.info(`[getAuthToken] extra dump: ${JSON.stringify(extra, null, 2)}`);

  // Try multiple possible structures for auth info
  const token =
    extra?.authInfo?.token ||
    (extra as { authInfo?: { accessToken?: string } })?.authInfo?.accessToken;
  logger.info(`[getAuthToken] resolved token: ${token ? `${token.substring(0, 20)}...` : "none"}`);

  return token && token.length > 0 ? token : undefined;
}
