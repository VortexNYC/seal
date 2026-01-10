import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SealApiClient } from "../client.js";
import { registerDocumentResources } from "./documents.js";
import { registerTemplateResources } from "./templates.js";

/**
 * Registers all resources with the MCP server.
 */
export function registerAllResources(
	server: McpServer,
	client: SealApiClient,
): void {
	registerDocumentResources(server, client);
	registerTemplateResources(server, client);
}
