import { describe, expect, it } from "vitest";

import {
  isEnvelopeClosed,
  presentedWorkflowStatus,
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
});
