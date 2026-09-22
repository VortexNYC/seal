/**
 * Document field placement + binding tools (Extend-inspired agent surface).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

const documentIdShape = {
  id: z.string().describe("The document ID"),
};

const fieldTypeSchema = z.enum([
  "signature",
  "text",
  "number",
  "date",
  "checkbox",
  "dropdown",
  "radio",
  "attachment",
  "payment",
]);

export function registerFieldTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_document_fields",
    "List all fields on a document including page, percent-of-page geometry (x/y/width/height), and binding_key. Use before apply-bindings or to verify agent field placement.",
    documentIdShape,
    async (args, extra) => {
      const { id } = args as { id: string };
      const authToken = getAuthToken(extra);
      const response = await client.get<{ fields: unknown[] }>(
        "/documents/fields",
        { id },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_create_document_field",
    "Place a field on a draft document. Coordinates are percent-of-page (0–100), same as the Seal web editor. Optionally set binding_key for structured fill via seal_apply_document_bindings.",
    {
      id: z.string().describe("Document ID"),
      field_type: fieldTypeSchema.describe("Field type"),
      label: z.string().describe("Field label shown to the signer"),
      page: z.number().int().describe("1-based page number"),
      x: z.number().describe("Left edge as % of page width (0–100)"),
      y: z.number().describe("Top edge as % of page height (0–100)"),
      width: z.number().describe("Width as % of page width"),
      height: z.number().describe("Height as % of page height"),
      is_required: z.boolean().optional().describe("Required for signing"),
      recipient_id: z
        .string()
        .optional()
        .describe("Assign field to a recipient ID"),
      binding_key: z
        .string()
        .optional()
        .describe("Structured data key for seal_apply_document_bindings"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/fields",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_update_document_field",
    "Update a document field (label, required, geometry, recipient, binding_key). Draft documents only.",
    {
      id: z.string().describe("Document ID"),
      field_id: z.string().describe("Field ID"),
      label: z.string().optional(),
      is_required: z.boolean().optional(),
      page: z.number().int().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      recipient_id: z.string().nullable().optional(),
      binding_key: z.string().nullable().optional(),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.put<unknown>(
        "/documents/fields/update",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_delete_document_field",
    "Delete a field from a draft document.",
    {
      id: z.string().describe("Document ID"),
      field_id: z.string().describe("Field ID to delete"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/fields/delete",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_apply_document_bindings",
    "Fill draft document fields by binding_key. Pass a map of binding_key → value; sets each field's default_value. Use after template/document fields have binding_key set (proposal/deal sync without OCR).",
    {
      id: z.string().describe("Document ID"),
      bindings: z
        .record(z.string(), z.string())
        .describe("Map of binding_key to string value"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/apply-bindings",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_place_field_candidates",
    "Place fields from the document's detected field_candidates (markdown heuristics with suggested bounding boxes). Optionally pass indices to place a subset, and recipient_id to assign all placed fields.",
    {
      id: z.string().describe("Document ID"),
      indices: z
        .array(z.number().int())
        .optional()
        .describe("Optional subset of candidate indices to place"),
      recipient_id: z
        .string()
        .optional()
        .describe("Assign placed fields to this recipient"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/place-candidates",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_field_suggestions",
    "Get pending field suggestions with bounding boxes for a document (materialized from field_candidates when needed). Review then apply with seal_apply_field_suggestions.",
    documentIdShape,
    async (args, extra) => {
      const { id } = args as { id: string };
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/documents/field-suggestions",
        { id },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_apply_field_suggestions",
    "Apply pending field suggestions onto a draft document (creates real signature fields). Pass selected_indices to apply a subset.",
    {
      id: z.string().describe("Document ID"),
      suggestion_id: z
        .string()
        .describe("Suggestion public_id from seal_get_field_suggestions"),
      selected_indices: z
        .array(z.number().int())
        .optional()
        .describe("Optional subset of suggestion field indices"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/field-suggestions/apply",
        args,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_update_template_field",
    "Update a template field, including properties.binding_key for structured deal fill.",
    {
      template_id: z.string().describe("Template ID"),
      field_id: z.string().describe("Template field ID"),
      label: z.string().optional(),
      is_required: z.boolean().optional(),
      binding_key: z
        .string()
        .optional()
        .describe("Set properties.binding_key on the template field"),
      properties: z.record(z.string(), z.unknown()).optional(),
    },
    async (args, extra) => {
      const {
        template_id,
        field_id,
        label,
        is_required,
        binding_key,
        properties,
      } = args as {
        template_id: string;
        field_id: string;
        label?: string;
        is_required?: boolean;
        binding_key?: string;
        properties?: Record<string, unknown>;
      };
      const authToken = getAuthToken(extra);
      const nextProperties: Record<string, unknown> = {
        ...(properties ?? {}),
      };
      if (binding_key) {
        nextProperties.binding_key = binding_key;
      }
      const response = await client.put<unknown>(
        "/templates/fields/update",
        {
          template_id,
          field_id,
          label,
          is_required,
          properties:
            Object.keys(nextProperties).length > 0 ? nextProperties : undefined,
        },
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
