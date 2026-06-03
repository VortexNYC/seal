/**
 * @fileoverview Recipient tools for the Seal MCP server.
 * Uses shared validation schemas from @seal/backend.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { z } from "zod";

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

const BULK_BATCH_SIZE = 5;

type BulkOperationResult = {
  success: boolean;
};

interface AddRecipientBulkResult extends BulkOperationResult {
  id: string;
  email: string;
  error?: string;
}

interface UpdateRecipientBulkResult extends BulkOperationResult {
  id: string;
  error?: string;
}

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

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function processInBatches<TItem, TResult extends BulkOperationResult>(
  items: TItem[],
  processItem: (item: TItem) => Promise<TResult>,
): Promise<{ results: TResult[]; successCount: number }> {
  const results: TResult[] = [];
  let successCount = 0;

  for (let i = 0; i < items.length; i += BULK_BATCH_SIZE) {
    const batch = items.slice(i, i + BULK_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(processItem));
    results.push(...batchResults);
    successCount += batchResults.filter((result) => result.success).length;

    if (i + BULK_BATCH_SIZE < items.length) {
      await wait(100);
    }
  }

  return { results, successCount };
}

async function addRecipientWithResult(
  client: SealApiClient,
  documentId: string,
  recipient: AddRecipientsBulkInput["recipients"][number],
  authToken: string | undefined,
): Promise<AddRecipientBulkResult> {
  try {
    const response = await client.post<{ id: string }>(
      "/recipients",
      recipient,
      { document_id: documentId },
      authToken,
    );

    return {
      id: response.id,
      email: recipient.email,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to add recipient ${recipient.email}: ${message}`);
    return {
      id: "",
      email: recipient.email,
      success: false,
      error: message,
    };
  }
}

async function updateRecipientWithResult(
  client: SealApiClient,
  documentId: string,
  update: UpdateRecipientsBulkInput["updates"][number],
  authToken: string | undefined,
): Promise<UpdateRecipientBulkResult> {
  try {
    await client.put<{ success: boolean }>(
      "/recipients/update",
      {
        name: update.name,
        role: update.role,
        order: update.order,
        message: update.message,
      },
      { document_id: documentId, id: update.id },
      authToken,
    );

    return {
      id: update.id,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to update recipient ${update.id}: ${message}`);
    return {
      id: update.id,
      success: false,
      error: message,
    };
  }
}

function registerListRecipientsTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_list_recipients",
    "List all recipients for a document. Returns each recipient's role (signer, approver, or viewer), signing status (pending, completed, declined), signing order for sequential workflows, and contact details. Use this to check who still needs to sign or to find recipient IDs for sending reminders.",
    listRecipientsSchema.shape,
    async (args, extra) => {
      const { document_id } = args as ListRecipientsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{ recipients: ApiRecipient[] }>(
        "/recipients",
        { document_id },
        authToken,
      );

      return createToolResponse(response);
    },
  );
}

function registerGetRecipientTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_get_recipient",
    "Get detailed information about a specific recipient on a document. Returns name, email, role (signer/approver/viewer), signing status, signing order, completion timestamp, and any custom message. Use this when you need full details about one recipient rather than listing all of them.",
    getRecipientSchema.shape,
    async (args, extra) => {
      const { document_id, id } = args as GetRecipientInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiRecipient>(
        "/recipients/get",
        { document_id, id },
        authToken,
      );

      return createToolResponse(response);
    },
  );
}

function registerAddRecipientTool(server: McpServer, client: SealApiClient): void {
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

      return createToolResponse(response);
    },
  );
}

function registerUpdateRecipientTool(server: McpServer, client: SealApiClient): void {
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

      return createToolResponse(response);
    },
  );
}

function registerRemoveRecipientTool(server: McpServer, client: SealApiClient): void {
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

      return createToolResponse(response);
    },
  );
}

function registerSendReminderTool(server: McpServer, client: SealApiClient): void {
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

      return createToolResponse(response);
    },
  );
}

function registerAddRecipientsBulkTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_add_recipients_bulk",
    "Add multiple recipients to a document at once. Useful for setting up complex signing workflows with many participants.",
    addRecipientsBulkSchema.shape,
    async (args, extra) => {
      const { document_id, recipients } = args as AddRecipientsBulkInput;
      const authToken = getAuthToken(extra);
      const { results, successCount } = await processInBatches(recipients, (recipient) =>
        addRecipientWithResult(client, document_id, recipient, authToken),
      );

      return createToolResponse({
        added: successCount,
        failed: recipients.length - successCount,
        total_requested: recipients.length,
        recipients: results,
      });
    },
  );
}

function registerUpdateRecipientsBulkTool(server: McpServer, client: SealApiClient): void {
  server.tool(
    "seal_update_recipients_bulk",
    "Update multiple recipients for a document at once. Useful for making batch changes to recipient details.",
    updateRecipientsBulkSchema.shape,
    async (args, extra) => {
      const { document_id, updates } = args as UpdateRecipientsBulkInput;
      const authToken = getAuthToken(extra);
      const { results, successCount } = await processInBatches(updates, (update) =>
        updateRecipientWithResult(client, document_id, update, authToken),
      );

      return createToolResponse({
        updated: successCount,
        failed: updates.length - successCount,
        total_requested: updates.length,
        recipients: results,
      });
    },
  );
}

/**
 * Registers all recipient-related tools with the MCP server.
 */
export function registerRecipientTools(server: McpServer, client: SealApiClient): void {
  registerListRecipientsTool(server, client);
  registerGetRecipientTool(server, client);
  registerAddRecipientTool(server, client);
  registerUpdateRecipientTool(server, client);
  registerRemoveRecipientTool(server, client);
  registerSendReminderTool(server, client);
  registerAddRecipientsBulkTool(server, client);
  registerUpdateRecipientsBulkTool(server, client);
}
