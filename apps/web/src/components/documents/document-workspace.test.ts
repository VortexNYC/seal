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
});
