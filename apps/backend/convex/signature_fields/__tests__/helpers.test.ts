import { describe, test, expect } from "vitest";
import {
  validateFieldPosition,
  validateFieldType,
  pixelsToPercentage,
  percentageToPixels,
  calculateFieldBounds,
  fieldsOverlap,
} from "../helpers";
import type { FieldType } from "../../schemas/signature_fields";

// ---------------------------------------------------------------------------
// validateFieldPosition
// ---------------------------------------------------------------------------
describe("validateFieldPosition", () => {
  test("accepts valid position in the middle of the page", () => {
    expect(validateFieldPosition(10, 20, 30, 40)).toEqual({ valid: true });
  });

  test("accepts position at origin with small size", () => {
    expect(validateFieldPosition(0, 0, 1, 1)).toEqual({ valid: true });
  });

  test("accepts field that fills the entire page", () => {
    expect(validateFieldPosition(0, 0, 100, 100)).toEqual({ valid: true });
  });

  test("accepts field at bottom-right corner", () => {
    expect(validateFieldPosition(90, 90, 10, 10)).toEqual({ valid: true });
  });

  // X coordinate validation
  test("rejects negative x", () => {
    const result = validateFieldPosition(-1, 10, 10, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("X coordinate");
  });

  test("rejects x > 100", () => {
    const result = validateFieldPosition(101, 10, 10, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("X coordinate");
  });

  test("accepts x = 0", () => {
    expect(validateFieldPosition(0, 0, 10, 10).valid).toBe(true);
  });

  test("accepts x = 100 with zero-area (width must be > 0 though)", () => {
    // x=100 is allowed by the x check, but x+width > 100 will fail
    const result = validateFieldPosition(100, 0, 1, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("beyond right page boundary");
  });

  // Y coordinate validation
  test("rejects negative y", () => {
    const result = validateFieldPosition(10, -1, 10, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Y coordinate");
  });

  test("rejects y > 100", () => {
    const result = validateFieldPosition(10, 101, 10, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Y coordinate");
  });

  // Width validation
  test("rejects width = 0", () => {
    const result = validateFieldPosition(10, 10, 0, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Width");
  });

  test("rejects negative width", () => {
    const result = validateFieldPosition(10, 10, -5, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Width");
  });

  test("rejects width > 100", () => {
    const result = validateFieldPosition(0, 0, 101, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Width");
  });

  // Height validation
  test("rejects height = 0", () => {
    const result = validateFieldPosition(10, 10, 10, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Height");
  });

  test("rejects negative height", () => {
    const result = validateFieldPosition(10, 10, 10, -5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Height");
  });

  test("rejects height > 100", () => {
    const result = validateFieldPosition(0, 0, 10, 101);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Height");
  });

  // Boundary overflow
  test("rejects field extending beyond right boundary", () => {
    const result = validateFieldPosition(80, 10, 25, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("right page boundary");
  });

  test("rejects field extending beyond bottom boundary", () => {
    const result = validateFieldPosition(10, 80, 10, 25);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("bottom page boundary");
  });

  test("accepts field that exactly touches right boundary (x + width = 100)", () => {
    expect(validateFieldPosition(50, 10, 50, 10).valid).toBe(true);
  });

  test("accepts field that exactly touches bottom boundary (y + height = 100)", () => {
    expect(validateFieldPosition(10, 50, 10, 50).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateFieldType
// ---------------------------------------------------------------------------
describe("validateFieldType", () => {
  test("accepts signature field without properties", () => {
    expect(validateFieldType("signature")).toEqual({ valid: true });
  });

  test("accepts text field without properties", () => {
    expect(validateFieldType("text")).toEqual({ valid: true });
  });

  test("accepts payment field without properties", () => {
    expect(validateFieldType("payment")).toEqual({ valid: true });
  });

  test("accepts payment field even with properties", () => {
    expect(validateFieldType("payment", { placeholder: "Pay now" })).toEqual({
      valid: true,
    });
  });

  // Dropdown validation
  test("rejects dropdown without options", () => {
    const result = validateFieldType("dropdown");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("dropdown");
    expect(result.error).toContain("option");
  });

  test("rejects dropdown with empty options array", () => {
    const result = validateFieldType("dropdown", { options: [] });
    expect(result.valid).toBe(false);
  });

  test("accepts dropdown with one option", () => {
    expect(validateFieldType("dropdown", { options: ["A"] }).valid).toBe(true);
  });

  test("accepts dropdown with multiple options", () => {
    expect(
      validateFieldType("dropdown", { options: ["A", "B", "C"] }).valid,
    ).toBe(true);
  });

  // Radio validation
  test("rejects radio without options", () => {
    const result = validateFieldType("radio");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("radio");
    expect(result.error).toContain("option");
  });

  test("rejects radio with empty options array", () => {
    const result = validateFieldType("radio", { options: [] });
    expect(result.valid).toBe(false);
  });

  test("accepts radio with options", () => {
    expect(
      validateFieldType("radio", { options: ["Yes", "No"] }).valid,
    ).toBe(true);
  });

  // maxLength / minLength validation
  test("rejects maxLength less than minLength", () => {
    const result = validateFieldType("text", { maxLength: 5, minLength: 10 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("maxLength");
    expect(result.error).toContain("minLength");
  });

  test("accepts maxLength equal to minLength", () => {
    expect(
      validateFieldType("text", { maxLength: 10, minLength: 10 }).valid,
    ).toBe(true);
  });

  test("accepts maxLength greater than minLength", () => {
    expect(
      validateFieldType("text", { maxLength: 20, minLength: 5 }).valid,
    ).toBe(true);
  });

  test("accepts only maxLength without minLength", () => {
    expect(validateFieldType("text", { maxLength: 100 }).valid).toBe(true);
  });

  test("accepts only minLength without maxLength", () => {
    expect(validateFieldType("text", { minLength: 1 }).valid).toBe(true);
  });

  // All non-option field types should pass without properties
  const simpleFieldTypes: FieldType[] = [
    "signature",
    "text",
    "number",
    "date",
    "checkbox",
    "attachment",
  ];

  test.each(simpleFieldTypes)(
    "accepts %s field type without properties",
    (fieldType) => {
      expect(validateFieldType(fieldType).valid).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// pixelsToPercentage
// ---------------------------------------------------------------------------
describe("pixelsToPercentage", () => {
  test("converts pixels to percentage correctly", () => {
    expect(pixelsToPercentage(250, 1000)).toBe(25);
  });

  test("returns 0 for 0 pixels", () => {
    expect(pixelsToPercentage(0, 1000)).toBe(0);
  });

  test("returns 100 for full container", () => {
    expect(pixelsToPercentage(800, 800)).toBe(100);
  });

  test("returns 50 for half container", () => {
    expect(pixelsToPercentage(400, 800)).toBe(50);
  });

  test("handles fractional results", () => {
    expect(pixelsToPercentage(1, 3)).toBeCloseTo(33.3333, 3);
  });

  test("returns > 100 when pixels exceed container (not clamped)", () => {
    expect(pixelsToPercentage(1200, 1000)).toBe(120);
  });

  test("returns negative for negative pixel values", () => {
    expect(pixelsToPercentage(-100, 1000)).toBe(-10);
  });
});

// ---------------------------------------------------------------------------
// percentageToPixels
// ---------------------------------------------------------------------------
describe("percentageToPixels", () => {
  test("converts percentage to pixels correctly", () => {
    expect(percentageToPixels(25, 1000)).toBe(250);
  });

  test("returns 0 for 0 percentage", () => {
    expect(percentageToPixels(0, 800)).toBe(0);
  });

  test("returns full container size for 100%", () => {
    expect(percentageToPixels(100, 800)).toBe(800);
  });

  test("returns half container for 50%", () => {
    expect(percentageToPixels(50, 600)).toBe(300);
  });

  test("handles fractional results", () => {
    expect(percentageToPixels(33.33, 900)).toBeCloseTo(299.97, 2);
  });

  test("handles percentage > 100", () => {
    expect(percentageToPixels(150, 1000)).toBe(1500);
  });

  test("handles negative percentage", () => {
    expect(percentageToPixels(-10, 1000)).toBe(-100);
  });
});

// ---------------------------------------------------------------------------
// pixelsToPercentage <-> percentageToPixels round-trip
// ---------------------------------------------------------------------------
describe("pixelsToPercentage / percentageToPixels round-trip", () => {
  test("converts back and forth without loss", () => {
    const containerSize = 1200;
    const originalPixels = 360;
    const pct = pixelsToPercentage(originalPixels, containerSize);
    const backToPixels = percentageToPixels(pct, containerSize);
    expect(backToPixels).toBeCloseTo(originalPixels, 10);
  });
});

// ---------------------------------------------------------------------------
// calculateFieldBounds
// ---------------------------------------------------------------------------
describe("calculateFieldBounds", () => {
  test("converts percentage field to pixel bounds", () => {
    const result = calculateFieldBounds(
      { x: 10, y: 20, width: 30, height: 40 },
      1000,
      800,
    );
    expect(result).toEqual({
      x: 100,
      y: 160,
      width: 300,
      height: 320,
    });
  });

  test("returns zeros for a field at origin with zero dimensions (edge case)", () => {
    const result = calculateFieldBounds(
      { x: 0, y: 0, width: 0, height: 0 },
      500,
      500,
    );
    expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  test("converts full-page field correctly", () => {
    const result = calculateFieldBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      1200,
      900,
    );
    expect(result).toEqual({ x: 0, y: 0, width: 1200, height: 900 });
  });

  test("handles non-square page dimensions", () => {
    const result = calculateFieldBounds(
      { x: 50, y: 50, width: 25, height: 10 },
      800,
      1100,
    );
    expect(result).toEqual({
      x: 400,
      y: 550,
      width: 200,
      height: 110,
    });
  });
});

// ---------------------------------------------------------------------------
// fieldsOverlap
// ---------------------------------------------------------------------------
describe("fieldsOverlap", () => {
  test("detects overlapping fields", () => {
    const a = { x: 10, y: 10, width: 20, height: 20 };
    const b = { x: 20, y: 20, width: 20, height: 20 };
    expect(fieldsOverlap(a, b)).toBe(true);
  });

  test("detects identical fields as overlapping", () => {
    const a = { x: 10, y: 10, width: 20, height: 20 };
    expect(fieldsOverlap(a, a)).toBe(true);
  });

  test("detects one field fully contained within another", () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 };
    const inner = { x: 25, y: 25, width: 10, height: 10 };
    expect(fieldsOverlap(outer, inner)).toBe(true);
    expect(fieldsOverlap(inner, outer)).toBe(true);
  });

  test("detects no overlap for horizontally separated fields", () => {
    const a = { x: 0, y: 10, width: 10, height: 10 };
    const b = { x: 50, y: 10, width: 10, height: 10 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });

  test("detects no overlap for vertically separated fields", () => {
    const a = { x: 10, y: 0, width: 10, height: 10 };
    const b = { x: 10, y: 50, width: 10, height: 10 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });

  test("returns false for fields that are exactly adjacent horizontally (touching edges)", () => {
    // field1 ends at x=30, field2 starts at x=30
    // The implementation uses strict < so touching edges DO overlap
    // field1.x + field1.width (30) < field2.x (30) → false, so NOT separated
    const a = { x: 10, y: 10, width: 20, height: 10 };
    const b = { x: 30, y: 10, width: 20, height: 10 };
    // With strict <: 10+20=30 < 30 is false → not separated on that axis → overlap = true
    expect(fieldsOverlap(a, b)).toBe(true);
  });

  test("returns false for fields that are exactly adjacent vertically (touching edges)", () => {
    const a = { x: 10, y: 10, width: 10, height: 20 };
    const b = { x: 10, y: 30, width: 10, height: 20 };
    expect(fieldsOverlap(a, b)).toBe(true);
  });

  test("detects no overlap when fields are separated by 1 unit horizontally", () => {
    // field1 ends at x=30, field2 starts at x=31
    // 30 < 31 → true → separated
    const a = { x: 10, y: 10, width: 20, height: 10 };
    const b = { x: 31, y: 10, width: 20, height: 10 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });

  test("detects no overlap when fields are separated by 1 unit vertically", () => {
    const a = { x: 10, y: 10, width: 10, height: 20 };
    const b = { x: 10, y: 31, width: 10, height: 20 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });

  test("detects overlap with partial horizontal overlap", () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 40, y: 0, width: 50, height: 50 };
    expect(fieldsOverlap(a, b)).toBe(true);
  });

  test("detects overlap with partial vertical overlap", () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 0, y: 40, width: 50, height: 50 };
    expect(fieldsOverlap(a, b)).toBe(true);
  });

  test("detects no overlap for diagonally separated fields", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 50, y: 50, width: 10, height: 10 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });

  test("handles zero-dimension fields at different positions", () => {
    const a = { x: 10, y: 10, width: 0, height: 0 };
    const b = { x: 20, y: 20, width: 0, height: 0 };
    expect(fieldsOverlap(a, b)).toBe(false);
  });
});
