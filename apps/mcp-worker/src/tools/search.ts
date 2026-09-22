/**
 * @fileoverview Workspace search tool for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

const searchSchema = z.object({
  q: z.string().min(1).describe("Search query"),
  types: z
    .string()
    .optional()
    .describe(
      "Comma-separated resource types: document,contact,template (default: all)"
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results (1–100, default 20)"),
});

/**
 * Registers the search tool with the MCP server.
 */
export function registerSearchTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_search",
    "Search across documents, contacts, and templates in the workspace. Respects document sharing rules for the caller. Prefer this over listing everything when looking for a specific item.",
    searchSchema.shape,
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<{ data: unknown[] }>(
        "/search",
        {
          q: args.q,
          types: args.types,
          limit: args.limit,
        },
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
