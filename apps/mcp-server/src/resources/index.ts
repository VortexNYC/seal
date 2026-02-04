import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { SealApiClient } from "../client";
import { registerDocumentResources } from "./documents";
import { registerTemplateResources } from "./templates";

/**
 * Registers all resources with the MCP server.
 */
export function registerAllResources(server: McpServer, client: SealApiClient): void {
  registerDocumentResources(server, client);
  registerTemplateResources(server, client);
}
