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
    "Get layout/OCR-style blocks (page, bbox 0–1, text, type) from anydoc field candidates plus annotation heuristics over parsed text.",
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

  server.tool(
    "seal_organize_document_pdf",
    "Reorder or delete pages of a draft PDF in place. Pass the new order as 1-based source page numbers (omit a page to delete it). Fields on deleted pages are removed; others are remapped.",
    {
      id: z.string().describe("Document ID"),
      pages: z
        .array(z.number().int().min(1))
        .min(1)
        .max(500)
        .describe(
          "New page order using original 1-based page numbers, e.g. [3,1,2] moves page 3 first and drops page 4+"
        ),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/organize",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_watermark_document_pdf",
    "Stamp a text watermark (e.g. DRAFT, CONFIDENTIAL) onto a draft PDF. Deterministic pdf-lib — not Seal AI.",
    {
      id: z.string().describe("Document ID"),
      text: z.string().min(1).max(120).describe("Watermark text"),
      opacity: z.number().min(0.05).max(1).optional(),
      position: z.enum(["diagonal", "center", "footer"]).optional(),
      color: z.string().optional().describe("Hex color"),
      size: z.number().min(6).max(120).optional(),
      pages: z
        .array(z.number().int().min(1))
        .optional()
        .describe("1-based pages; omit for all"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/watermark",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_number_document_pdf_pages",
    "Stamp footer page numbers onto a draft PDF (`n` or `n_of_m`). Deterministic pdf-lib — not Seal AI.",
    {
      id: z.string().describe("Document ID"),
      format: z.enum(["n", "n_of_m"]).optional(),
      position: z
        .enum(["footer-center", "footer-right", "footer-left"])
        .optional(),
      start_at: z.number().int().min(0).optional(),
      prefix: z.string().max(40).optional().describe('e.g. "Page "'),
      size: z.number().min(6).max(48).optional(),
      color: z.string().optional(),
      pages: z.array(z.number().int().min(1)).optional(),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/number-pages",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_crop_document_pdf",
    "Crop draft PDF pages to a top-left percent rect (0–100, same space as fields). Bakes a smaller page. Fields outside the crop are removed; survivors remapped.",
    {
      id: z.string().describe("Document ID"),
      crops: z
        .array(
          z.object({
            page: z.number().int().min(1),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            width: z.number().min(1).max(100),
            height: z.number().min(1).max(100),
          })
        )
        .min(1)
        .max(500)
        .describe(
          "Per-page crops. Example: [{ page: 1, x: 5, y: 5, width: 90, height: 90 }] trims a 5% margin"
        ),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/crop",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_compress_document_pdf",
    "Compress a draft PDF in place (re-encodes images via convert-worker PDF engines — structure/text untouched, never enlarges). Returns size_before/size_after.",
    {
      id: z.string().describe("Document ID"),
      image_quality: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("JPEG quality for re-encoded images (default 80)"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/compress",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_redact_document_pdf",
    "Permanently redact regions of a draft PDF — removes text/images/paths inside each percent rect from the bytes (not an overlay). Returns a receipt (scrubbed_text). Fields inside regions are removed.",
    {
      id: z.string().describe("Document ID"),
      regions: z
        .array(
          z.object({
            page: z.number().int().min(1),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            width: z.number().min(0.5).max(100),
            height: z.number().min(0.5).max(100),
          })
        )
        .min(1)
        .max(200)
        .describe("Percent rects to redact (same space as fields)"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/redact",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_protect_document_pdf",
    "Create a password-protected copy of a draft PDF (qpdf encrypt via convert-worker). Draft stays unencrypted; returns download_url for the encrypted artifact.",
    {
      id: z.string().describe("Document ID"),
      user_password: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .describe("Password required to open"),
      owner_password: z
        .string()
        .min(1)
        .max(128)
        .optional()
        .describe("Owner password (full access)"),
      allow_printing: z.boolean().optional(),
      allow_copying: z.boolean().optional(),
      allow_modifying: z.boolean().optional(),
      allow_annotating: z.boolean().optional(),
      allow_filling_forms: z.boolean().optional(),
      allow_assembling: z.boolean().optional(),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/protect",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_export_document_pdf_images",
    "Export every page of a draft PDF as images — returns a ZIP artifact (page-N.png|jpg) and download_url. Working draft unchanged.",
    {
      id: z.string().describe("Document ID"),
      format: z.enum(["png", "jpeg"]).default("png").describe("Image format"),
      dpi: z
        .number()
        .min(50)
        .max(600)
        .default(150)
        .describe("Render DPI (50–600)"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/export-images",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_ocr_document_pdf",
    "OCR a draft PDF — adds a searchable text layer to scanned/image pages (ocrmypdf --skip-text; existing text preserved).",
    {
      id: z.string().describe("Document ID"),
      lang: z
        .string()
        .regex(/^[a-z]{3}(\+[a-z]{3})*$/)
        .default("eng")
        .describe("Tesseract language code(s), e.g. eng or eng+fra"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/ocr",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_flatten_document_pdf",
    "Flatten annotations and AcroForm fields into page content (pdfengines/flatten). Seal signature fields (stored in the database) are unaffected.",
    {
      id: z.string().describe("Document ID"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/flatten",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_unlock_document_pdf",
    "Unlock a password-protected draft PDF in place (LibreOffice re-export — may shift complex layouts). Claims the usable bytes onto the document.",
    {
      id: z.string().describe("Document ID"),
      password: z.string().min(1).max(128).describe("PDF open password"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/documents/pdf/unlock",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
