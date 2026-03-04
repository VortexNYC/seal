import { describe, expect, mock, test } from "bun:test";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SealApiClient } from "../client";
import type { Config } from "../config";
import { registerAllTools } from "./index";

const mockConfig: Config = {
  baseUrl: "https://api.test.com",
  apiKey: "test-api-key",
  requestTimeout: 5000,
  debug: false,
  maxFileSize: 50 * 1024 * 1024,
};

describe("registerAllTools", () => {
  test("registers all expected tools", () => {
    const registeredTools: string[] = [];

    const mockServer = {
      tool: mock((name: string) => {
        registeredTools.push(name);
      }),
    } as unknown as McpServer;

    const client = new SealApiClient(mockConfig);
    registerAllTools(mockServer, client);

    // Document tools
    expect(registeredTools).toContain("seal_list_documents");
    expect(registeredTools).toContain("seal_get_document");
    expect(registeredTools).toContain("seal_create_document");
    expect(registeredTools).toContain("seal_update_document");
    expect(registeredTools).toContain("seal_delete_document");
    expect(registeredTools).toContain("seal_send_document");
    expect(registeredTools).toContain("seal_void_document");
    expect(registeredTools).toContain("seal_download_document");
    expect(registeredTools).toContain("seal_bulk_send_documents");
    expect(registeredTools).toContain("seal_bulk_void_documents");
    expect(registeredTools).toContain("seal_get_document_access");
    expect(registeredTools).toContain("seal_update_document_access");

    // Template tools
    expect(registeredTools).toContain("seal_list_templates");
    expect(registeredTools).toContain("seal_get_template");
    expect(registeredTools).toContain("seal_get_template_fields");
    expect(registeredTools).toContain("seal_create_template");
    expect(registeredTools).toContain("seal_update_template");
    expect(registeredTools).toContain("seal_delete_template");
    expect(registeredTools).toContain("seal_use_template");

    // Recipient tools
    expect(registeredTools).toContain("seal_list_recipients");
    expect(registeredTools).toContain("seal_get_recipient");
    expect(registeredTools).toContain("seal_add_recipient");
    expect(registeredTools).toContain("seal_add_recipients_bulk");
    expect(registeredTools).toContain("seal_update_recipient");
    expect(registeredTools).toContain("seal_update_recipients_bulk");
    expect(registeredTools).toContain("seal_remove_recipient");
    expect(registeredTools).toContain("seal_send_reminder");

    // Signature tools
    expect(registeredTools).toContain("seal_list_signatures");
    expect(registeredTools).toContain("seal_get_signature");
    expect(registeredTools).toContain("seal_verify_document");
    expect(registeredTools).toContain("seal_get_audit_trail");

    // Upload tools
    expect(registeredTools).toContain("seal_upload_file");
    expect(registeredTools).toContain("seal_upload_file_content");

    // Account & analytics
    expect(registeredTools).toContain("seal_get_account_info");
    expect(registeredTools).toContain("seal_get_analytics");

    // Audit log
    expect(registeredTools).toContain("seal_list_audit_log");

    // Members
    expect(registeredTools).toContain("seal_list_members");
    expect(registeredTools).toContain("seal_get_member");

    // Settings
    expect(registeredTools).toContain("seal_get_settings");
    expect(registeredTools).toContain("seal_update_settings");

    // Contacts
    expect(registeredTools).toContain("seal_list_contacts");
    expect(registeredTools).toContain("seal_get_contact");
    expect(registeredTools).toContain("seal_create_contact");
    expect(registeredTools).toContain("seal_delete_contact");

    // Webhooks
    expect(registeredTools).toContain("seal_list_webhooks");
    expect(registeredTools).toContain("seal_get_webhook");
    expect(registeredTools).toContain("seal_create_webhook");
    expect(registeredTools).toContain("seal_update_webhook");
    expect(registeredTools).toContain("seal_delete_webhook");
    expect(registeredTools).toContain("seal_rotate_webhook_secret");
    expect(registeredTools).toContain("seal_list_webhook_event_types");
  });

  test("registers correct number of tools", () => {
    const registeredTools: string[] = [];

    const mockServer = {
      tool: mock((name: string) => {
        registeredTools.push(name);
      }),
    } as unknown as McpServer;

    const client = new SealApiClient(mockConfig);
    registerAllTools(mockServer, client);

    // 12 document + 7 template + 8 recipient + 4 signature + 2 upload
    // + 2 account/analytics + 1 audit + 2 members + 2 settings + 4 contacts + 7 webhooks = 51 tools
    expect(registeredTools.length).toBe(51);
  });

  test("all registered tools have unique names", () => {
    const registeredTools: string[] = [];

    const mockServer = {
      tool: mock((name: string) => {
        registeredTools.push(name);
      }),
    } as unknown as McpServer;

    const client = new SealApiClient(mockConfig);
    registerAllTools(mockServer, client);

    const uniqueTools = new Set(registeredTools);
    expect(uniqueTools.size).toBe(registeredTools.length);
  });
});
