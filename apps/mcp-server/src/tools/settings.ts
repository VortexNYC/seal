/**
 * @fileoverview Organization settings tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  type ApiSettings,
  type UpdateSettingsInput,
  updateSettingsSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers all organization settings tools with the MCP server.
 */
export function registerSettingsTools(server: McpServer, client: SealApiClient): void {
  // Get settings
  server.tool(
    "seal_get_settings",
    "Get the current organization settings for your Seal workspace. Returns all configuration categories: signing (allowed methods, deadline, ESIGN consent), notifications (reminder schedule, completion/viewed emails), AI features (enabled, auto-analyze), and security (IP allowlist, MFA, session timeout, API access).",
    {},
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiSettings>("/settings", {}, authToken);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );

  // Update settings
  server.tool(
    "seal_update_settings",
    "Update organization settings. All fields are optional — only provide the categories and fields you want to change. Supports partial updates within each category (e.g. only update default_deadline_days without touching other signing settings). Categories: signing, notifications, ai, security.",
    updateSettingsSchema.shape,
    async (args, extra) => {
      const { signing, notifications, ai, security } = args as UpdateSettingsInput;
      const authToken = getAuthToken(extra);
      const response = await client.patch<{ success: boolean }>(
        "/settings",
        { signing, notifications, ai, security },
        authToken,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );
}
