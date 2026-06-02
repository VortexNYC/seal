/**
 * @fileoverview Authentication utilities for the Seal MCP server (Worker edition).
 *
 * The worker delegates auth to Seal Convex: it does not verify tokens, it just
 * forwards the inbound bearer to Seal's `/api/v1` resource server (which
 * validates it via `resolveMcpApiAuth`). The fetch handler (src/index.ts) puts
 * the bearer into the Agents SDK `McpAuthContext.props`; tool handlers read it
 * back here via `getMcpAuthContext()` and pass it through to the API client.
 */
import { getMcpAuthContext } from "agents/mcp";

import { logger } from "./logger";

/**
 * Type kept for signature compatibility with the original MCP SDK handlers.
 * In the Worker, auth comes from getMcpAuthContext().props, not from `extra`.
 */
export type McpRequestExtra = {
  authInfo?: { token: string; extra?: { userId?: string } };
};

/**
 * Returns the bearer token for the current MCP request (forwarded to Seal's
 * `/api/v1`), or undefined if no auth context is present.
 */
export function getAuthToken(_extra?: McpRequestExtra): string | undefined {
  const ctx = getMcpAuthContext();
  const token = ctx?.props?.token;
  if (typeof token !== "string" || token.length === 0) {
    logger.warn("[getAuthToken] no token in MCP auth context props");
    return undefined;
  }
  return token;
}
