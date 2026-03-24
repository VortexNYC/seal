/**
 * @fileoverview Additional document tools for the Seal MCP server —
 * document access/sharing mode, bulk send, and bulk void.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ApiDocumentAccess,
  type BulkOperationSummary,
  type BulkSendDocumentsInput,
  bulkSendDocumentsSchema,
  type BulkVoidDocumentsInput,
  bulkVoidDocumentsSchema,
  type GetDocumentAccessInput,
  getDocumentAccessSchema,
  type UpdateDocumentAccessInput,
  updateDocumentAccessSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers additional document tools with the MCP server.
 */
export function registerDocumentExtraTools(server: McpServer, client: SealApiClient): void {
  // Get document access
  server.tool(
    "seal_get_document_access",
    "Get the sharing/access mode for a document. Returns whether the document is private (owner only), workspace (all org members can see it), or specific (only explicitly granted users). Useful for auditing document visibility before sharing.",
    getDocumentAccessSchema.shape,
    async (args, extra) => {
      const { id } = args as GetDocumentAccessInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiDocumentAccess>("/documents/access", { id }, authToken);

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

  // Update document access
  server.tool(
    "seal_update_document_access",
    "Update the sharing/access mode for a document. Options: 'private' (owner only — the default), 'workspace' (all org members can view, requires Pro plan), 'specific' (only explicitly granted users, requires Pro plan). Does not change who can sign — only who can view the document in the workspace.",
    updateDocumentAccessSchema.shape,
    async (args, extra) => {
      const { id, sharing_mode } = args as UpdateDocumentAccessInput;
      const authToken = getAuthToken(extra);
      const response = await client.put<{ success: boolean }>(
        "/documents/access",
        { sharing_mode },
        { id },
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

  // Bulk void
  server.tool(
    "seal_bulk_void_documents",
    "Void (cancel) multiple documents at once. Maximum 50 documents per request. A reason is required and will be logged in the audit trail. Cannot void already-completed, already-cancelled, or already-declined documents — those will be reported as failures in the result. Returns per-document success/failure details.",
    bulkVoidDocumentsSchema.shape,
    async (args, extra) => {
      const { document_ids, reason } = args as BulkVoidDocumentsInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<BulkOperationSummary>(
        "/documents/bulk-void",
        { document_ids, reason },
        undefined,
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

  // Bulk send
  server.tool(
    "seal_bulk_send_documents",
    "Send multiple draft documents for signing at once. Maximum 50 documents per request. Each document must be in draft status and have at least one recipient — documents that don't meet these criteria will be reported as failures. An optional custom message can be included in all signing invitation emails. Returns per-document success/failure details.",
    bulkSendDocumentsSchema.shape,
    async (args, extra) => {
      const { document_ids, message } = args as BulkSendDocumentsInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<BulkOperationSummary>(
        "/documents/bulk-send",
        { document_ids, message },
        undefined,
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
