/**
 * @fileoverview Import job tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiImportJob,
  type CreateImportInput,
  createImportSchema,
  type ImportIdInput,
  importIdSchema,
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
 * Registers import tools with the MCP server.
 */
export function registerImportTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_imports",
    "List import jobs in your workspace (PDF batch, DocuSign, PandaDoc).",
    {},
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<{ data: ApiImportJob[] }>(
        "/imports",
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_create_import",
    "Create an import job in pending_approval status. Approve it to run the import.",
    createImportSchema.shape,
    async (args, extra) => {
      const { adapter, payload } = args as CreateImportInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ data: ApiImportJob }>(
        "/imports",
        { adapter, payload: payload ?? {} },
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_import",
    "Get a single import job by public ID.",
    importIdSchema.shape,
    async (args, extra) => {
      const { id } = args as ImportIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ data: ApiImportJob }>(
        `/imports/${id}`,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_approve_import",
    "Approve and run a pending import job. Returns processed counts and final status.",
    importIdSchema.shape,
    async (args, extra) => {
      const { id } = args as ImportIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ data: unknown }>(
        `/imports/${id}/approve`,
        {},
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_resume_import",
    "Resume an in-progress import job that has not completed or failed.",
    importIdSchema.shape,
    async (args, extra) => {
      const { id } = args as ImportIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ data: unknown }>(
        `/imports/${id}/resume`,
        {},
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
