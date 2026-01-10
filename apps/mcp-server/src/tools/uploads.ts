// @ts-nocheck - MCP SDK has known issues with deep Zod type inference
// Runtime validation still works correctly via Zod
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SealApiClient } from "../client.js";

/** Maximum file size: 50MB (matches backend validation) */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const getAuthToken = (extra: {
	authInfo?: { token: string };
}): string | undefined => {
	const token = extra.authInfo?.token;
	return token && token.length > 0 ? token : undefined;
};

const UploadFileSchema: Record<string, z.ZodTypeAny> = {
	file_path: z.string().describe("Absolute path to the PDF file to upload"),
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
		UploadFileSchema,
		async ({ file_path }, extra) => {
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
			if (stats.size > MAX_FILE_SIZE) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(
								{
									error: `File exceeds 50MB limit: ${(stats.size / 1024 / 1024).toFixed(2)}MB`,
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
