import { describe, expect, it } from "vitest";

import {
  isEnvelopeClosed,
  presentedWorkflowStatus,
  saveAsTemplateBlock,
} from "./workflow-status.js";

describe("presented workflow status", () => {
  it("shows an agent void as cancelled", () => {
    expect(presentedWorkflowStatus("voided")).toBe("cancelled");
    expect(presentedWorkflowStatus("cancelled")).toBe("cancelled");
    expect(presentedWorkflowStatus("sent")).toBe("sent");
  });

  it("treats both words as a closed envelope", () => {
    expect(isEnvelopeClosed("voided")).toBe(true);
    expect(isEnvelopeClosed("cancelled")).toBe(true);
    expect(isEnvelopeClosed("sent")).toBe(false);
  });

  it("lets a sent envelope become a template", () => {
    expect(saveAsTemplateBlock("sent", "active", "uploads/doc")).toBeNull();
    expect(saveAsTemplateBlock("completed", "active", "uploads/doc")).toBeNull();
    expect(saveAsTemplateBlock("draft", "active", "uploads/doc")).toBeNull();
    expect(saveAsTemplateBlock("voided", "active", "uploads/doc")).toBe("closed");
    expect(saveAsTemplateBlock("sent", "deleted", "uploads/doc")).toBe("closed");
    expect(saveAsTemplateBlock("sent", "active", null)).toBe("missing_file");
  });
});
