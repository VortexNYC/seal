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
}
