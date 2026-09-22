/**
 * @fileoverview API token management tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

const scopeSchema = z.enum(["read", "write", "sign", "admin"]);

const listTokensSchema = z.object({
  organization_slug: z
    .string()
    .describe("Organization slug (from seal_get_account_info)"),
});

const createTokenSchema = z.object({
  organization_slug: z.string().describe("Organization slug"),
  name: z.string().min(1).describe("Human-readable token name"),
  scopes: z
    .array(scopeSchema)
    .min(1)
    .describe("Scopes: read, write, sign, admin"),
});

const revokeTokenSchema = z.object({
  organization_slug: z.string().describe("Organization slug"),
  token_id: z.string().describe("Token id from list/create"),
});

/**
 * Registers API token tools with the MCP server.
 */
export function registerTokenTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_api_tokens",
    "List workspace API tokens (secrets are never returned). Requires admin/owner.",
    listTokensSchema.shape,
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown[]>(
        `/organizations/${encodeURIComponent(args.organization_slug)}/tokens`,
        {},
        authToken
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(response, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "seal_create_api_token",
    "Create a workspace API token. Returns the full seal_… secret once — store it. Requires admin/owner.",
    createTokenSchema.shape,
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        `/organizations/${encodeURIComponent(args.organization_slug)}/tokens`,
        { name: args.name, scopes: args.scopes },
        undefined,
        authToken
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(response, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "seal_revoke_api_token",
    "Revoke a workspace API token. Requires admin/owner.",
    revokeTokenSchema.shape,
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.delete<unknown>(
        `/organizations/${encodeURIComponent(args.organization_slug)}/tokens/${encodeURIComponent(args.token_id)}`,
        undefined,
        authToken
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(response, null, 2) },
        ],
      };
    }
  );
}
