/**
 * @fileoverview Audit log tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiAuditLogEntry,
  type ListAuditLogInput,
  listAuditLogSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers audit log tools with the MCP server.
 */
export function registerAuditTools(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_list_audit_log",
    "List organization-wide audit log entries. Returns a chronological history of all actions taken in the workspace — document sends, signings, settings changes, member additions, and more. Filter by document_id to see all events for a specific document, or filter by action type (e.g. 'document.completed', 'recipient.signed'). Supports date range filtering and pagination.",
    listAuditLogSchema.shape,
    async (args, extra) => {
      const { limit, cursor, document_id, action, created_after, created_before } =
        args as ListAuditLogInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{
        entries: ApiAuditLogEntry[];
        has_more: boolean;
        next_cursor?: string;
      }>(
        "/audit-log",
        { limit, cursor, document_id, action, created_after, created_before },
        authToken,
      );

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
