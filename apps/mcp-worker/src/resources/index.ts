import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { SealApiClient } from "../client";
import { registerDocsResources } from "./docs";
import { registerDocumentResources } from "./documents";
import { registerFeedbackResources } from "./feedback";
import { registerTemplateResources } from "./templates";

/**
 * Registers all resources with the MCP server.
 */
export function registerAllResources(server: McpServer, client: SealApiClient): void {
  registerDocumentResources(server, client);
  registerTemplateResources(server, client);
  registerFeedbackResources(server, client);
  registerDocsResources(server);
}
