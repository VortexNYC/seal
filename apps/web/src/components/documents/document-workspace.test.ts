import { describe, expect, it } from "vitest";

import {
  DOCUMENT_CAPABILITIES,
  getDocumentCapability,
} from "./document-workspace";

describe("DOCUMENT_CAPABILITIES", () => {
  it("keeps a stable one-roof id set for SPA + agents", () => {
    expect(DOCUMENT_CAPABILITIES.map((c) => c.id)).toEqual([
      "fields",
      "markup",
      "office",
      "pages",
      "layout",
    ]);
  });

  it("maps each capability to at least one agent tool", () => {
    for (const capability of DOCUMENT_CAPABILITIES) {
      expect(capability.agentTools.length).toBeGreaterThan(0);
    }
  });

  it("resolves known ids", () => {
    expect(getDocumentCapability("pages").label).toBe("Pages");
  });

  it("lists organize on Pages for agents", () => {
    expect(getDocumentCapability("pages").agentTools).toContain(
      "seal_organize_document_pdf"
    );
  });

  it("lists watermark and page numbers on Pages for agents", () => {
    const tools = getDocumentCapability("pages").agentTools;
    expect(tools).toContain("seal_watermark_document_pdf");
    expect(tools).toContain("seal_number_document_pdf_pages");
  });
});
