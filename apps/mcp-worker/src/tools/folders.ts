/**
 * @fileoverview Folder tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiFolder,
  type CreateFolderInput,
  createFolderSchema,
  type FolderBreadcrumbsInput,
  folderBreadcrumbsSchema,
  type ListFoldersInput,
  listFoldersSchema,
} from "../api-contracts";
import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

function createToolResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/**
 * Registers folder tools with the MCP server.
 */
export function registerFolderTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_folders",
    "List folders in your workspace. Filter by type (document/template), parent_id for children of a folder, or flat=true for the full tree of that type.",
    listFoldersSchema.shape,
    async (args, extra) => {
      const { type, parent_id, flat } = args as ListFoldersInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ folders: ApiFolder[] }>(
        "/folders",
        { type, parent_id, flat },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_create_folder",
    "Create a folder for documents or templates. Optionally nest under parent_id.",
    createFolderSchema.shape,
    async (args, extra) => {
      const body = args as CreateFolderInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<ApiFolder>(
        "/folders",
        body,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_folder_breadcrumbs",
    "Get the breadcrumb trail from root to a folder by public ID.",
    folderBreadcrumbsSchema.shape,
    async (args, extra) => {
      const { id } = args as FolderBreadcrumbsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{
        breadcrumbs: { id: string; name: string }[];
      }>("/folders/breadcrumbs", { id }, authToken);
      return createToolResponse(response);
    }
  );
}
