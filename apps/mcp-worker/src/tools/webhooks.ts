/**
 * @fileoverview Webhook management tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ApiWebhookEndpoint,
  type ApiWebhookEventType,
  type CreateWebhookInput,
  createWebhookSchema,
  type GetWebhookInput,
  getWebhookSchema,
  type UpdateWebhookInput,
  updateWebhookSchema,
  type WebhookIdInput,
  webhookIdSchema,
  listWebhooksSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

function createToolResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function registerListWebhooksTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_webhooks",
    "List all webhook endpoints configured for your organization. Returns endpoint details including delivery statistics.",
    listWebhooksSchema.shape,
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiWebhookEndpoint[]>(
        "/webhooks",
        {},
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerGetWebhookTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_get_webhook",
    "Get details for a specific webhook endpoint including its delivery statistics and subscription settings.",
    getWebhookSchema.shape,
    async (args, extra) => {
      const { id } = args as GetWebhookInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiWebhookEndpoint>(
        "/webhooks/get",
        { id },
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerCreateWebhookTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_create_webhook",
    "Create a new webhook endpoint. Returns the endpoint details including the signing secret — save it securely as it is only shown once.",
    createWebhookSchema.shape,
    async (args, extra) => {
      const { name, url, events, description } = args as CreateWebhookInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ id: string; secret: string }>(
        "/webhooks",
        { name, url, events, description },
        undefined,
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerUpdateWebhookTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_update_webhook",
    "Update a webhook endpoint's configuration. You can change the URL, subscribed events, status, or description. Only provide fields you want to change.",
    updateWebhookSchema.shape,
    async (args, extra) => {
      const { id, name, url, events, description, status } =
        args as UpdateWebhookInput;
      const authToken = getAuthToken(extra);
      const response = await client.put<{ success: boolean }>(
        "/webhooks/update",
        { name, url, events, description, status },
        { id },
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerDeleteWebhookTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_delete_webhook",
    "Permanently delete a webhook endpoint and all its delivery history. This action cannot be undone.",
    webhookIdSchema.shape,
    async (args, extra) => {
      const { id } = args as WebhookIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.delete<{ success: boolean }>(
        "/webhooks/delete",
        { id },
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerRotateWebhookSecretTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_rotate_webhook_secret",
    "Rotate the signing secret for a webhook endpoint. Returns the new secret — save it securely and update your server immediately as the old secret stops working right away.",
    webhookIdSchema.shape,
    async (args, extra) => {
      const { id } = args as WebhookIdInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ secret: string }>(
        "/webhooks/rotate-secret",
        {},
        { id },
        authToken
      );

      return createToolResponse(response);
    }
  );
}

function registerListWebhookEventTypesTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_webhook_event_types",
    "List all available webhook event types with descriptions. Use this to discover which events you can subscribe to when creating or updating a webhook.",
    {},
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiWebhookEventType[]>(
        "/webhooks/event-types",
        {},
        authToken
      );

      return createToolResponse(response);
    }
  );
}

/**
 * Registers all webhook management tools with the MCP server.
 */
export function registerWebhookTools(
  server: McpServer,
  client: SealApiClient
): void {
  registerListWebhooksTool(server, client);
  registerGetWebhookTool(server, client);
  registerCreateWebhookTool(server, client);
  registerUpdateWebhookTool(server, client);
  registerDeleteWebhookTool(server, client);
  registerRotateWebhookSecretTool(server, client);
  registerListWebhookEventTypesTool(server, client);
}
