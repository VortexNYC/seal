/**
 * @fileoverview Recipient tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  type AddRecipientInput,
  type ApiRecipient,
  addRecipientSchema,
  type GetRecipientInput,
  getRecipientSchema,
  type ListRecipientsInput,
  listRecipientsSchema,
  type RemoveRecipientInput,
  removeRecipientSchema,
  type SendReminderInput,
  sendReminderSchema,
  type UpdateRecipientInput,
  updateRecipientSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";
import { logger } from "../utils/logger";

// Bulk operations schemas for MCP server
const addRecipientsBulkSchema = z.object({
  document_id: z.string().describe("The document ID"),
  recipients: z
    .array(addRecipientSchema.omit({ document_id: true }))
    .describe("Array of recipients to add"),
});
type AddRecipientsBulkInput = z.infer<typeof addRecipientsBulkSchema>;

const updateRecipientsBulkSchema = z.object({
  document_id: z.string().describe("The document ID"),
  updates: z
    .array(
      updateRecipientSchema.omit({ document_id: true }).extend({
        id: z.string().describe("The recipient ID to update"),
      }),
    )
    .describe("Array of recipient updates"),
});
type UpdateRecipientsBulkInput = z.infer<typeof updateRecipientsBulkSchema>;

/**
 * Registers all recipient-related tools with the MCP server.
 */
export function registerRecipientTools(server: McpServer, client: SealApiClient): void {
  // List recipients
  server.tool(
    "seal_list_recipients",
    "List all recipients for a document. Recipients are the people who need to sign or review the document.",
    listRecipientsSchema.shape,
    async (args, extra) => {
      const { document_id } = args as ListRecipientsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ recipients: ApiRecipient[] }>(
        "/recipients",
        { document_id },
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

  // Get recipient
  server.tool(
    "seal_get_recipient",
    "Get detailed information about a specific recipient.",
    getRecipientSchema.shape,
    async (args, extra) => {
      const { document_id, id } = args as GetRecipientInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiRecipient>(
        "/recipients/get",
        {
          document_id,
          id,
        },
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

  // Add recipient
  server.tool(
    "seal_add_recipient",
    "Add a recipient to a document. The document must be in draft status.",
    addRecipientSchema.shape,
    async (args, extra) => {
      const { document_id, email, name, role, order, message } = args as AddRecipientInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ id: string }>(
        "/recipients",
        { email, name, role, order, message },
        { document_id },
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

  // Update recipient
  server.tool(
    "seal_update_recipient",
    "Update a recipient's details. The document must be in draft status.",
    updateRecipientSchema.shape,
    async (args, extra) => {
      const { document_id, id, name, role, order, message } = args as UpdateRecipientInput;
      const authToken = getAuthToken(extra);
      const response = await client.put<{ success: boolean }>(
        "/recipients/update",
        { name, role, order, message },
        { document_id, id },
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

  // Remove recipient
  server.tool(
    "seal_remove_recipient",
    "Remove a recipient from a document. The document must be in draft status.",
    removeRecipientSchema.shape,
    async (args, extra) => {
      const { document_id, id } = args as RemoveRecipientInput;
      const authToken = getAuthToken(extra);
      const response = await client.delete<{ success: boolean }>(
        "/recipients/delete",
        { document_id, id },
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

  // Send reminder
  server.tool(
    "seal_send_reminder",
    "Send a signing reminder to a recipient. Only works for recipients who haven't signed yet.",
    sendReminderSchema.shape,
    async (args, extra) => {
      const { document_id, id, message } = args as SendReminderInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ success: boolean }>(
        "/recipients/remind",
        { message },
        { document_id, id },
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

  // Bulk add recipients
  server.tool(
    "seal_add_recipients_bulk",
    "Add multiple recipients to a document at once. Useful for setting up complex signing workflows with many participants.",
    addRecipientsBulkSchema.shape,
    async (args, extra) => {
      const { document_id, recipients } = args as AddRecipientsBulkInput;
      const authToken = getAuthToken(extra);

      const results: {
        id: string;
        email: string;
        success: boolean;
        error?: string;
      }[] = [];
      let successCount = 0;

      // Process recipients in parallel for better performance, but limit concurrency to avoid overwhelming the API
      const BATCH_SIZE = 5;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (recipient) => {
          try {
            const response = await client.post<{ id: string }>(
              "/recipients",
              recipient,
              { document_id },
              authToken,
            );
            return {
              id: response.id,
              email: recipient.email,
              success: true,
            };
          } catch (error) {
            logger.warn(
              `Failed to add recipient ${recipient.email}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return {
              id: "",
              email: recipient.email,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        successCount += batchResults.filter((r) => r.success).length;

        // Small delay between batches to be respectful to the API
        if (i + BATCH_SIZE < recipients.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                added: successCount,
                failed: recipients.length - successCount,
                total_requested: recipients.length,
                recipients: results,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Bulk update recipients
  server.tool(
    "seal_update_recipients_bulk",
    "Update multiple recipients for a document at once. Useful for making batch changes to recipient details.",
    updateRecipientsBulkSchema.shape,
    async (args, extra) => {
      const { document_id, updates } = args as UpdateRecipientsBulkInput;
      const authToken = getAuthToken(extra);

      const results: { id: string; success: boolean; error?: string }[] = [];
      let successCount = 0;

      // Process updates in parallel for better performance, but limit concurrency
      const BATCH_SIZE = 5;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (update) => {
          try {
            await client.put<{ success: boolean }>(
              "/recipients/update",
              {
                name: update.name,
                role: update.role,
                order: update.order,
                message: update.message,
              },
              { document_id, id: update.id },
              authToken,
            );
            return {
              id: update.id,
              success: true,
            };
          } catch (error) {
            logger.warn(
              `Failed to update recipient ${update.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return {
              id: update.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        successCount += batchResults.filter((r) => r.success).length;

        // Small delay between batches to be respectful to the API
        if (i + BATCH_SIZE < updates.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                updated: successCount,
                failed: updates.length - successCount,
                total_requested: updates.length,
                recipients: results,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
