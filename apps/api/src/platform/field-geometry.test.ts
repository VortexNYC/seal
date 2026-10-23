import { describe, expect, it } from "vitest";

import { DEFAULT_FIELD_SIZE_PERCENT } from "./field-types.js";
import {
  confidenceForCandidateType,
  geometryFromLine,
  mapCandidateTypeToFieldType,
  validateFieldGeometry,
} from "./field-geometry.js";

describe("field-geometry", () => {
  it("sizes an email field for a full address on a letter page", () => {
    expect(DEFAULT_FIELD_SIZE_PERCENT.email).toEqual({ width: 34, height: 4 });
  });

  it("maps candidate types to Seal field types", () => {
    expect(mapCandidateTypeToFieldType("signature")).toBe("signature");
    expect(mapCandidateTypeToFieldType("initials")).toBe("initials");
    expect(mapCandidateTypeToFieldType("name")).toBe("name");
    expect(mapCandidateTypeToFieldType("email")).toBe("email");
    expect(mapCandidateTypeToFieldType("date")).toBe("date");
    expect(mapCandidateTypeToFieldType("phone")).toBe("phone");
    expect(mapCandidateTypeToFieldType("cells")).toBe("cells");
  });

  it("estimates geometry from line index within page bounds", () => {
    const geo = geometryFromLine("signature", 10);
    expect(geo.x).toBe(10);
    expect(geo.width).toBe(DEFAULT_FIELD_SIZE_PERCENT.signature.width);
    expect(geo.height).toBe(DEFAULT_FIELD_SIZE_PERCENT.signature.height);
    // Line index ≈ rule under the signature → field bottom at lineY
    expect(geo.y + geo.height).toBe(18);
    expect(validateFieldGeometry(geo).valid).toBe(true);
  });

  it("anchors text fields from the line top, not the bottom", () => {
    const geo = geometryFromLine("text", 10);
    expect(geo.y).toBe(18);
    expect(validateFieldGeometry(geo).valid).toBe(true);
  });

  it("clamps near end of page", () => {
    const geo = geometryFromLine("signature", 500);
    expect(geo.y + geo.height).toBeLessThanOrEqual(100);
    expect(validateFieldGeometry(geo).valid).toBe(true);
  });

  it("scores signature candidates higher", () => {
    expect(confidenceForCandidateType("signature")).toBeGreaterThan(
      confidenceForCandidateType("text")
    );
  });
});
