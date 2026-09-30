/**
 * Document Workspace — one roof for human SPA + agent tools.
 *
 * Capabilities share a document id and chrome. Fields, Mark up, Pages, and
 * read-only view share one EmbedPDF `DocumentCanvas` mount; Office / Layout
 * swap panels on the same roof. New work extends this registry — no peer “modes”.
 *
 * Agent MCP tool names are listed so the SPA and MCP stay the same surface.
 */

export const DOCUMENT_CAPABILITIES = [
  {
    id: "fields",
    label: "Fields",
    description: "Place signature and form fields for signing",
    agentTools: [
      "seal_place_field",
      "seal_update_field",
      "seal_delete_field",
      "seal_list_fields",
    ] as const,
  },
  {
    id: "markup",
    label: "Mark up",
    description: "Draw, highlight, or redact on the PDF",
    agentTools: [
      "seal_annotate_document_pdf",
      "seal_replace_document_pdf",
    ] as const,
  },
  {
    id: "office",
    label: "Office",
    description: "Edit the Word / Excel / CSV original",
    agentTools: ["seal_replace_document_original"] as const,
  },
  {
    id: "pages",
    label: "Pages",
    description: "Rotate, combine, or split into drafts",
    agentTools: [
      "seal_rotate_document_pdf",
      "seal_merge_documents_pdf",
      "seal_split_document",
    ] as const,
  },
  {
    id: "layout",
    label: "Layout",
    description: "Map regions for agents and extraction",
    agentTools: [
      "seal_get_document_layout_blocks",
      "seal_get_document_extraction_schema",
      "seal_put_document_extraction_schema",
    ] as const,
  },
] as const;

export type DocumentCapabilityId = (typeof DOCUMENT_CAPABILITIES)[number]["id"];

export function getDocumentCapability(
  id: DocumentCapabilityId
): (typeof DOCUMENT_CAPABILITIES)[number] {
  const found = DOCUMENT_CAPABILITIES.find((capability) => capability.id === id);
  if (!found) {
    return DOCUMENT_CAPABILITIES[0];
  }
  return found;
}
