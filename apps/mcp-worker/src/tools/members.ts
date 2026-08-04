/**
 * @fileoverview Team member tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ApiMember,
  type GetMemberInput,
  getMemberSchema,
  type ListMembersInput,
  listMembersSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers all team member tools with the MCP server.
 */
export function registerMemberTools(
  server: McpServer,
  client: SealApiClient
): void {
  // List members
  server.tool(
    "seal_list_members",
    "List all members of your Seal workspace. Returns each member's name, email, role (owner/admin/member/viewer), membership status, and join date. Optionally filter by role. Use this to find team members, check who is an admin, or discover member IDs for other operations.",
    listMembersSchema.shape,
    async (args, extra) => {
      const { role } = args as ListMembersInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ data: ApiMember[] }>(
        "/members",
        { role },
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

  // Get member
  server.tool(
    "seal_get_member",
    "Get detailed information about a specific workspace member by their membership ID. Returns name, email, role, status, and when they joined. Use seal_list_members first to find the member ID.",
    getMemberSchema.shape,
    async (args, extra) => {
      const { id } = args as GetMemberInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiMember>(
        "/members/get",
        { id },
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
