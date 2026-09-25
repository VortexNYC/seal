import { describe, expect, it } from "vitest";

import {
  describeEsignOptOutMethod,
  resolveEsignOptOutMethod,
} from "./esign-opt-out.js";

describe("esign-opt-out (SEA-58)", () => {
  it("resolves known methods and defaults unknown", () => {
    expect(resolveEsignOptOutMethod("download_pdf")).toBe("download_pdf");
    expect(resolveEsignOptOutMethod("paper_copy_request")).toBe(
      "paper_copy_request"
    );
    expect(resolveEsignOptOutMethod("contact_sender")).toBe("contact_sender");
    expect(resolveEsignOptOutMethod("weird")).toBe("paper_copy_request");
    expect(resolveEsignOptOutMethod(null)).toBe("paper_copy_request");
  });

  it("describes each method for owner notifications", () => {
    expect(describeEsignOptOutMethod("download_pdf")).toMatch(/manual/i);
    expect(describeEsignOptOutMethod("paper_copy_request")).toMatch(/paper/i);
    expect(describeEsignOptOutMethod("contact_sender")).toMatch(/sender/i);
  });
});
