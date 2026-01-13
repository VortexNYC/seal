import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SealApiClient } from "../client";
import { registerDocumentTools } from "./documents";
import { registerRecipientTools } from "./recipients";
import { registerSignatureTools } from "./signatures";
import { registerTemplateTools } from "./templates";
import { registerUploadTools } from "./uploads";

/**
 * Registers all tools with the MCP server.
 */
export function registerAllTools(
	server: McpServer,
	client: SealApiClient,
): void {
	registerDocumentTools(server, client);
	registerTemplateTools(server, client);
	registerRecipientTools(server, client);
	registerSignatureTools(server, client);
	registerUploadTools(server, client);
}
