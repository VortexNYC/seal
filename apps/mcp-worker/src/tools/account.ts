/**
 * @fileoverview Account/organization info tool for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { type ApiAccountInfo, getAccountInfoSchema } from "../api-contracts";
import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers the account info tool with the MCP server.
 */
export function registerAccountTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_get_account_info",
    "Get information about the current Seal workspace — organization name, member counts, document counts by status, signing settings, and whether AI features are enabled. Useful for understanding the current account context.",
    getAccountInfoSchema.shape,
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiAccountInfo>(
        "/account",
        {},
        authToken
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}
