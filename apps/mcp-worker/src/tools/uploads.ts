/**
 * @fileoverview Upload tools for the Seal MCP server (Cloudflare Worker edition).
 *
 * The original Node version had `seal_upload_file` (local-fs path) which only
 * worked in stdio mode (file paths refer to the SERVER's filesystem — useless
 * for an HTTP-deployed server). Workers don't have node:fs, and the tool was
 * dead code in HTTP mode anyway. Only `seal_upload_file_content` (base64) is
 * kept here — it works in all transports.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type UploadFileContentInput,
  uploadFileContentSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

class UploadValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function createToolResponse(payload: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function toUploadErrorResponse(error: unknown) {
  if (error instanceof UploadValidationError) {
    return createToolResponse(
      { error: error.message, details: error.details },
      true,
    );
  }
  return createToolResponse(
    { error: error instanceof Error ? error.message : String(error) },
    true,
  );
}

// PDF starts with %PDF- (0x25 0x50 0x44 0x46 0x2D). Validate magic bytes so
// we don't waste storage on malformed uploads. Buffer is globally available
// in the Worker via the `nodejs_compat` compatibility flag (wrangler.jsonc).
function decodeValidatedPdfContent(base64: string): Buffer {
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(base64, "base64");
  } catch {
    throw new UploadValidationError("Invalid base64 encoding");
  }
  if (!fileBuffer.subarray(0, 5).toString().startsWith("%PDF-")) {
    throw new UploadValidationError("Content is not a valid PDF (invalid magic bytes)");
  }
  return fileBuffer;
}

async function getUploadUrl(client: SealApiClient, authToken: string | undefined): Promise<string> {
  const { upload_url } = await client.post<{ upload_url: string }>(
    "/uploads/generate-url",
    {},
    undefined,
    authToken,
  );
  return upload_url;
}

function registerUploadFileContentTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_upload_file_content",
    "Upload a PDF file using base64-encoded content. Returns a storage_id for use with create_document.",
    uploadFileContentSchema.shape,
    async (args, extra) => {
      const { file_name, content_base64 } = args as UploadFileContentInput;
      const authToken = getAuthToken(extra);

      try {
        const fileBuffer = decodeValidatedPdfContent(content_base64);
        const uploadUrl = await getUploadUrl(client, authToken);
        const storageId = await client.uploadToStorage(uploadUrl, fileBuffer, "application/pdf");

        return createToolResponse({
          storage_id: storageId,
          file_name,
          file_size: fileBuffer.length,
        });
      } catch (error) {
        return toUploadErrorResponse(error);
      }
    },
  );
}

/**
 * Registers upload-related tools with the MCP server.
 * Worker edition: only the base64-content variant (no local-fs).
 */
export function registerUploadTools(server: McpServer, client: SealApiClient): void {
  registerUploadFileContentTool(server, client);
}
