import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SealApiClient } from "../client.js";
import { registerDocumentTools } from "./documents.js";
import { registerRecipientTools } from "./recipients.js";
import { registerSignatureTools } from "./signatures.js";
import { registerTemplateTools } from "./templates.js";

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
}
