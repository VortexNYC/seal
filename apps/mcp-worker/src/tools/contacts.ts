/**
 * @fileoverview Contact directory tools for the Seal MCP server.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type ApiContact,
  type CreateContactInput,
  createContactSchema,
  type DeleteContactInput,
  deleteContactSchema,
  type GetContactInput,
  getContactSchema,
  type ListContactsInput,
  listContactsSchema,
} from "@seal/backend/convex/validations/api";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

/**
 * Registers all contact directory tools with the MCP server.
 */
export function registerContactTools(
  server: McpServer,
  client: SealApiClient
): void {
  // List contacts
  server.tool(
    "seal_list_contacts",
    "List contacts in your workspace contact directory. Returns name, email, company, title, status, and tags. Filter by status (active, inactive, or lead) or search by name/email. Useful for looking up recipients before sending a document — use the email here when adding recipients.",
    listContactsSchema.shape,
    async (args, extra) => {
      const { limit, cursor, status, search } = args as ListContactsInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<{
        contacts: ApiContact[];
        has_more: boolean;
        next_cursor?: string;
      }>("/contacts", { limit, cursor, status, search }, authToken);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // Get contact
  server.tool(
    "seal_get_contact",
    "Get full details for a specific contact by ID. Returns all stored information including name, email, company, title, tags, notes, and contact history timestamps.",
    getContactSchema.shape,
    async (args, extra) => {
      const { id } = args as GetContactInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiContact>(
        "/contacts/get",
        { id },
        authToken
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // Create contact
  server.tool(
    "seal_create_contact",
    "Add a new contact to your workspace directory. Contacts can be referenced when adding document recipients. Required: first_name, last_name, email. Optional: phone, company, title, status (active/inactive/lead), notes, tags.",
    createContactSchema.shape,
    async (args, extra) => {
      const {
        first_name,
        last_name,
        email,
        phone,
        company,
        title,
        status,
        notes,
        tags,
      } = args as CreateContactInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ id: string }>(
        "/contacts",
        {
          first_name,
          last_name,
          email,
          phone,
          company,
          title,
          status,
          notes,
          tags,
        },
        undefined,
        authToken
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // Delete contact
  server.tool(
    "seal_delete_contact",
    "Permanently delete a contact from your workspace directory. This cannot be undone. The contact's ID is required.",
    deleteContactSchema.shape,
    async (args, extra) => {
      const { id } = args as DeleteContactInput;
      const authToken = getAuthToken(extra);
      const response = await client.delete<{ success: boolean }>(
        "/contacts/delete",
        { id },
        authToken
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}
