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
    expect(registeredTools).toContain("list_documents");
    expect(registeredTools).toContain("get_document");
    expect(registeredTools).toContain("create_document");
    expect(registeredTools).toContain("update_document");
    expect(registeredTools).toContain("delete_document");
    expect(registeredTools).toContain("send_document");
    expect(registeredTools).toContain("void_document");
    expect(registeredTools).toContain("download_document");

    // Template tools
    expect(registeredTools).toContain("list_templates");
    expect(registeredTools).toContain("get_template");
    expect(registeredTools).toContain("get_template_fields");
    expect(registeredTools).toContain("create_template");
    expect(registeredTools).toContain("update_template");
    expect(registeredTools).toContain("delete_template");
    expect(registeredTools).toContain("use_template");

    // Recipient tools
    expect(registeredTools).toContain("list_recipients");
    expect(registeredTools).toContain("get_recipient");
    expect(registeredTools).toContain("add_recipient");
    expect(registeredTools).toContain("add_recipients_bulk");
    expect(registeredTools).toContain("update_recipient");
    expect(registeredTools).toContain("update_recipients_bulk");
    expect(registeredTools).toContain("remove_recipient");
    expect(registeredTools).toContain("send_reminder");

    // Signature tools
    expect(registeredTools).toContain("list_signatures");
    expect(registeredTools).toContain("get_signature");
    expect(registeredTools).toContain("verify_document");
    expect(registeredTools).toContain("get_audit_trail");

    // Upload tools
    expect(registeredTools).toContain("upload_file");
    expect(registeredTools).toContain("upload_file_content");

    // Debug tools
    expect(registeredTools).toContain("debug_auth");
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

    // 8 document + 7 template + 8 recipient + 4 signature + 2 upload + 1 debug = 30 tools
    expect(registeredTools.length).toBe(30);
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
