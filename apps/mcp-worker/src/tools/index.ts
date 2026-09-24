import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { SealApiClient } from "../client";
import { registerAccountTools } from "./account";
import { registerAnalyticsTools } from "./analytics";
import { registerAuditTools } from "./audit";
import { registerContactTools } from "./contacts";
import { registerDocumentAgentTools } from "./document_agent";
import { registerDocumentExtraTools } from "./document_extra";
import { registerFieldTools } from "./fields";
import { registerDocumentTools } from "./documents";
import { registerFolderTools } from "./folders";
import { registerImportTools } from "./imports";
import { registerInteractionTools } from "./interaction";
import { registerMemberTools } from "./members";
import { registerRecipientTools } from "./recipients";
import { registerSearchTools } from "./search";
import { registerSettingsTools } from "./settings";
import { registerSignatureTools } from "./signatures";
import { registerTemplateTools } from "./templates";
import { registerTokenTools } from "./tokens";
import { registerUploadTools } from "./uploads";
import { registerWebhookTools } from "./webhooks";

/**
 * Registers all tools with the MCP server.
 */
export function registerAllTools(
  server: McpServer,
  client: SealApiClient
): void {
  registerAccountTools(server, client);
  registerAnalyticsTools(server, client);
  registerAuditTools(server, client);
  registerContactTools(server, client);
  registerDocumentTools(server, client);
  registerDocumentExtraTools(server, client);
  registerDocumentAgentTools(server, client);
  registerFieldTools(server, client);
  registerFolderTools(server, client);
  registerImportTools(server, client);
  registerInteractionTools(server, client);
  registerMemberTools(server, client);
  registerRecipientTools(server, client);
  registerSearchTools(server, client);
  registerSettingsTools(server, client);
  registerSignatureTools(server, client);
  registerTemplateTools(server, client);
  registerTokenTools(server, client);
  registerUploadTools(server, client);
  registerWebhookTools(server, client);
}
