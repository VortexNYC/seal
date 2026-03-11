/**
 * @fileoverview Upload tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */

import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type UploadFileContentInput,
  type UploadFileInput,
  uploadFileContentSchema,
  uploadFileSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getConfig } from "../config";
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

function isStdioMode(): boolean {
  return (
    process.argv.includes("--stdio") ||
    (process.stdin.isTTY === false && process.stdout.isTTY === false) ||
    process.env.MCP_TRANSPORT === "stdio"
  );
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

function getMaxFileSize(): number {
  return getConfig().maxFileSize;
}

function formatMb(size: number): string {
  return `${(size / 1024 / 1024).toFixed(2)}MB`;
}

function ensurePdfMagicBytes(fileBuffer: Buffer, errorMessage: string): void {
  if (!fileBuffer.subarray(0, 5).toString().startsWith("%PDF-")) {
    throw new UploadValidationError(errorMessage);
  }
}

function ensureFileSizeWithinLimit(size: number, maxFileSize: number): void {
  if (size > maxFileSize) {
    throw new UploadValidationError(
      `File exceeds ${(maxFileSize / 1024 / 1024).toFixed(0)}MB limit: ${formatMb(size)}`,
    );
  }
}

function toUploadErrorResponse(error: unknown) {
  if (error instanceof UploadValidationError) {
    return createToolResponse(
      {
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      true,
    );
  }

  throw error;
}

async function getValidatedFileSize(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      throw new UploadValidationError(`Path is not a file: ${filePath}`);
    }

    const fileSize = Number(stats.size);
    ensureFileSizeWithinLimit(fileSize, getMaxFileSize());
    return fileSize;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new UploadValidationError(`File not found: ${filePath}`, message);
  }
}

async function readValidatedPdfFile(filePath: string): Promise<{
  fileBuffer: Buffer;
  fileSize: number;
}> {
  const fileSize = await getValidatedFileSize(filePath);
  const fileBuffer = await readFile(filePath);
  ensurePdfMagicBytes(fileBuffer, "File is not a valid PDF (invalid magic bytes)");

  return {
    fileBuffer,
    fileSize,
  };
}

function decodeValidatedPdfContent(contentBase64: string): Buffer {
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(contentBase64, "base64");
  } catch {
    throw new UploadValidationError("Invalid base64 encoding");
  }

  ensureFileSizeWithinLimit(fileBuffer.length, getMaxFileSize());
  ensurePdfMagicBytes(fileBuffer, "Content is not a valid PDF (invalid magic bytes)");
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

function registerUploadFileTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_upload_file",
    "Upload a PDF file to Seal storage. Returns a storage_id for use with create_document.",
    uploadFileSchema.shape,
    async (args, extra) => {
      const { file_path } = args as UploadFileInput;
      const authToken = getAuthToken(extra);

      if (!isStdioMode()) {
        return createToolResponse(
          {
            error:
              "upload_file is only available in stdio mode because it reads local file paths on the server.",
          },
          true,
        );
      }

      try {
        const { fileSize } = await readValidatedPdfFile(file_path);
        const uploadUrl = await getUploadUrl(client, authToken);
        const storageId = await client.uploadToStorageStream(
          uploadUrl,
          createReadStream(file_path),
          "application/pdf",
          fileSize,
        );

        return createToolResponse({
          storage_id: storageId,
          file_name: basename(file_path),
          file_size: fileSize,
        });
      } catch (error) {
        return toUploadErrorResponse(error);
      }
    },
  );
}

function registerUploadFileContentTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_upload_file_content",
    "Upload a PDF file using base64-encoded content. Works in all modes (stdio and HTTP). Returns a storage_id for use with create_document.",
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
 */
export function registerUploadTools(server: McpServer, client: SealApiClient): void {
  registerUploadFileTool(server, client);
  registerUploadFileContentTool(server, client);
}
