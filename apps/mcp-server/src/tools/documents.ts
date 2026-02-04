/**
 * @fileoverview Document tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiDocument,
  type CreateDocumentInput,
  createDocumentSchema,
  type DocumentIdInput,
  documentIdSchema,
  type GetDocumentInput,
  getDocumentSchema,
  type ListDocumentsInput,
  listDocumentsSchema,
  type PaginatedResponse,
  type SendDocumentInput,
  sendDocumentSchema,
  type UpdateDocumentInput,
  updateDocumentSchema,
  type VoidDocumentInput,
  voidDocumentSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers all document-related tools with the MCP server.
 */
export function registerDocumentTools(server: McpServer, client: SealApiClient): void {
  // List documents
  server.tool(
    "list_documents",
    "List all documents in your Seal workspace with pagination. Returns document metadata including title, status, and recipient counts.",
    listDocumentsSchema.shape,
    async (args, extra) => {
      const { limit, cursor, status } = args as ListDocumentsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<PaginatedResponse<ApiDocument>>(
        "/documents",
        { limit, cursor, status },
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

  // Get document
  server.tool(
    "get_document",
    "Get detailed information about a specific document including recipients and download URL.",
    getDocumentSchema.shape,
    async (args, extra) => {
      const { id, include_recipients } = args as GetDocumentInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiDocument>(
        "/documents/get",
        {
          id,
          include_recipients,
        },
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

  // Create document
  server.tool(
    "create_document",
    "Create a new document in draft status. Requires a storage ID from a previously uploaded file.",
    createDocumentSchema.shape,
    async (args, extra) => {
      const { title, description, storage_id, file_size, file_type, page_count, deadline } =
        args as CreateDocumentInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ id: string }>(
        "/documents",
        {
          title,
          description,
          storage_id,
          file_size,
          file_type,
          page_count,
          deadline: deadline ? new Date(deadline).getTime() : undefined,
        },
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

  // Update document
  server.tool(
    "update_document",
    "Update document metadata. Only works for documents in draft status.",
    updateDocumentSchema.shape,
    async (args, extra) => {
      const { id, title, description, deadline } = args as UpdateDocumentInput;
      const authToken = getAuthToken(extra);
      const response = await client.put<{ success: boolean }>(
        "/documents/update",
        {
          title,
          description,
          deadline: deadline ? new Date(deadline).getTime() : undefined,
        },
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

  // Delete document
  server.tool(
    "delete_document",
    "Delete a document. Only draft documents can be deleted. Use void_document for sent documents.",
    documentIdSchema.shape,
    async (args, extra) => {
      const { id } = args as DocumentIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.delete<{ success: boolean }>(
        "/documents/delete",
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

  // Send document
  server.tool(
    "send_document",
    "Send a document for signing. The document must be in draft status and have at least one recipient.",
    sendDocumentSchema.shape,
    async (args, extra) => {
      const { id, message } = args as SendDocumentInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ success: boolean }>(
        "/documents/send",
        { message },
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

  // Void document
  server.tool(
    "void_document",
    "Void/cancel a document. Cannot void completed documents. All recipients will be notified.",
    voidDocumentSchema.shape,
    async (args, extra) => {
      const { id, reason } = args as VoidDocumentInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ success: boolean }>(
        "/documents/void",
        { reason },
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

  // Download document
  server.tool(
    "download_document",
    "Get the download URL for a document. Returns the signed PDF if available, otherwise the original.",
    documentIdSchema.shape,
    async (args, extra) => {
      const { id } = args as DocumentIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ url: string }>(
        "/documents/download",
        {
          id,
        },
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
