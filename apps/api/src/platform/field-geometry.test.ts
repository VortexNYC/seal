import { describe, expect, it } from "vitest";

import {
  confidenceForCandidateType,
  geometryFromLine,
  mapCandidateTypeToFieldType,
  validateFieldGeometry,
} from "./field-geometry.js";

describe("field-geometry", () => {
  it("maps candidate types to Seal field types", () => {
    expect(mapCandidateTypeToFieldType("signature")).toBe("signature");
    expect(mapCandidateTypeToFieldType("initials")).toBe("text");
    expect(mapCandidateTypeToFieldType("name")).toBe("text");
    expect(mapCandidateTypeToFieldType("date")).toBe("date");
  });

  it("estimates geometry from line index within page bounds", () => {
    const geo = geometryFromLine("signature", 10);
    expect(geo.x).toBe(10);
    expect(geo.width).toBe(33);
    expect(geo.height).toBe(6);
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
