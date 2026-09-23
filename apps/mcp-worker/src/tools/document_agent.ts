/**
 * Agent-power tools: annotations, preview, split, PDF annotate.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

function createToolResponse(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function registerDocumentAgentTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_get_document_annotations",
    "Get contract-review annotations (bbox citations) for a document — obligation/payment/risk/dates/terms with page highlights. Materializes from parsed text when needed.",
    { id: z.string().describe("Document ID") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/documents/annotations",
        { id: (args as { id: string }).id },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_generate_document_annotations",
    "Regenerate bbox citation annotations from the document's parsed text (heuristic contract review).",
    { id: z.string().describe("Document ID") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/annotations/generate",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_dismiss_document_annotations",
    "Dismiss active document annotations.",
    { id: z.string().describe("Document ID") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/annotations/dismiss",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_preview_document",
    "Preview a document for agents. format=markdown (parsed text + field_candidates), structured (markdown + csv_rows when original is CSV), pdf or original (signed download URL for the PDF or pre-conversion office/CSV file).",
    {
      id: z.string().describe("Document ID"),
      format: z
        .enum(["markdown", "structured", "pdf", "original"])
        .optional()
        .describe("Preview format (default markdown)"),
    },
    async (args, extra) => {
      const { id, format } = args as {
        id: string;
        format?: string;
      };
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/documents/preview",
        { id, format: format ?? "markdown" },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_split_document",
    "Split a draft PDF into child draft documents by page ranges. Each split gets title + pages (1-based). Returns created document IDs.",
    {
      id: z.string().describe("Source document ID"),
      splits: z
        .array(
          z.object({
            title: z.string(),
            pages: z.array(z.number().int()).min(1),
          })
        )
        .min(1)
        .describe("Child documents to create"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/split",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_annotate_document_pdf",
    "Bake agent PDF edits onto a draft document: highlight, text, rect, or redact ops using percent-of-page geometry (0–100). Rewrites the stored PDF.",
    {
      id: z.string().describe("Document ID"),
      operations: z
        .array(
          z.object({
            op: z.enum(["highlight", "text", "rect", "redact"]),
            page: z.number().int(),
            x: z.number(),
            y: z.number(),
            width: z.number().optional(),
            height: z.number().optional(),
            text: z.string().optional(),
            size: z.number().optional(),
            color: z.string().optional(),
          })
        )
        .min(1)
        .describe("Draw operations to apply"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/annotate",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_replace_document_pdf",
    "Replace a draft document's stored PDF bytes (base64). Use after local/agent PDF edits so humans and agents share the same file.",
    {
      id: z.string().describe("Document ID"),
      content_base64: z.string().describe("PDF file as base64"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const { id, content_base64 } = args as {
        id: string;
        content_base64: string;
      };
      const response = await client.post<unknown>(
        "/documents/pdf/replace",
        { id, contentBase64: content_base64 },
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_document_layout_blocks",
    "Get layout/OCR-style blocks (page, bbox 0–1, text, type) derived from document annotations for structure review.",
    { id: z.string().describe("Document ID") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/documents/layout-blocks",
        { id: (args as { id: string }).id },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_document_extraction_schema",
    "Get the extraction schema JSON for a document (agent + human Schema Builder).",
    { id: z.string().describe("Document ID") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/documents/extraction-schema",
        { id: (args as { id: string }).id },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_put_document_extraction_schema",
    "Save extraction schema JSON for a draft document.",
    {
      id: z.string().describe("Document ID"),
      schema: z
        .record(z.string(), z.unknown())
        .describe("JSON Schema-like object"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/extraction-schema",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_replace_document_original",
    "Replace the original office/CSV bytes for a draft document (base64 + content_type). Re-converts to PDF when convertible.",
    {
      id: z.string().describe("Document ID"),
      content_base64: z.string(),
      content_type: z.string(),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const { id, content_base64, content_type } = args as {
        id: string;
        content_base64: string;
        content_type: string;
      };
      const response = await client.post<unknown>(
        "/documents/original/replace",
        {
          id,
          contentBase64: content_base64,
          contentType: content_type,
        },
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_merge_documents_pdf",
    "Merge 2–20 draft document PDFs (by id, in order) into a new draft PDF document. Returns the new document id.",
    {
      ids: z
        .array(z.string())
        .min(2)
        .max(20)
        .describe("Document IDs in merge order"),
      title: z.string().optional().describe("Title for the merged draft"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/merge",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_rotate_document_pdf",
    "Rotate pages of a draft PDF by 90/180/270 degrees clockwise. Omit pages to rotate all.",
    {
      id: z.string().describe("Document ID"),
      degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
      pages: z
        .array(z.number().int())
        .optional()
        .describe("1-based page numbers; omit for all pages"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/rotate",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
