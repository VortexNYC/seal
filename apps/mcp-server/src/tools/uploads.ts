/**
 * @fileoverview Upload tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
	type UploadFileInput,
	uploadFileSchema,
} from "@seal/backend/convex/validations/api";
import type { SealApiClient } from "../client";
import { getConfig } from "../config";

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

/**
 * Registers upload-related tools with the MCP server.
 */
export function registerUploadTools(
	server: McpServer,
	client: SealApiClient,
): void {
	server.tool(
		"upload_file",
		"Upload a PDF file to Seal storage. Returns a storage_id for use with create_document.",
		uploadFileSchema.shape,
		async (args, extra) => {
			const { file_path } = args as UploadFileInput;
			const authToken = getAuthToken(extra);

			// 1. Validate file exists and get stats
			let stats: Awaited<ReturnType<typeof stat>>;
			try {
				stats = await stat(file_path);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{ error: `File not found: ${file_path}`, details: message },
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}

			if (!stats.isFile()) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{ error: `Path is not a file: ${file_path}` },
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}

			// 2. Validate file size
			const maxFileSize = getConfig().maxFileSize;
			if (stats.size > maxFileSize) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									error: `File exceeds ${(maxFileSize / 1024 / 1024).toFixed(0)}MB limit: ${(stats.size / 1024 / 1024).toFixed(2)}MB`,
								},
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}

			// 3. Read file and validate PDF magic bytes
			const fileBuffer = await readFile(file_path);
			const magicBytes = fileBuffer.subarray(0, 5).toString();
			if (!magicBytes.startsWith("%PDF-")) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{ error: "File is not a valid PDF (invalid magic bytes)" },
								null,
								2,
							),
						},
					],
					isError: true,
				};
			}

			// 4. Get upload URL from Seal API
			const { upload_url } = await client.post<{ upload_url: string }>(
				"/uploads/generate-url",
				{},
				undefined,
				authToken,
			);

			// 5. Upload file to Convex storage
			const storageId = await client.uploadToStorage(
				upload_url,
				fileBuffer,
				"application/pdf",
			);

			// 6. Return result
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								storage_id: storageId,
								file_name: basename(file_path),
								file_size: stats.size,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
