/**
 * @fileoverview Analytics tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiAnalytics,
  type GetAnalyticsInput,
  getAnalyticsSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers analytics tools with the MCP server.
 */
export function registerAnalyticsTools(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_get_analytics",
    "Get document signing analytics and metrics for your workspace. Returns document counts (created, sent, completed, cancelled, declined), completion rate percentage, and median signing time in hours — all filtered to a date range (default: last 30 days). Also includes a current workspace snapshot with live document counts by status. Use from/to parameters with ISO 8601 timestamps to customize the period.",
    getAnalyticsSchema.shape,
    async (args, extra) => {
      const { from, to } = args as GetAnalyticsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiAnalytics>("/analytics", { from, to }, authToken);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );
}
