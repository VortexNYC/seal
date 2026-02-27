import { describe, expect, test } from "vitest";

import { DocumentAnalysisSchema } from "./analyzeFieldsSchema";

describe("DocumentAnalysisSchema", () => {
  const validField = {
    fieldType: "signature" as const,
    page: 1,
    x: 20,
    y: 80,
    width: 25,
    height: 5,
    label: "Buyer Signature",
    confidence: 0.95,
    isRequired: true,
  };

  const validAnnotation = {
    page: 1,
    x: 10,
    y: 30,
    width: 80,
    height: 3,
    category: "payment" as const,
    severity: "important" as const,
    text: "Payment of $5,000 is due within 30 days of signing.",
    summary: "Payment of $5,000 due within 30 days",
  };

  // ─── Valid analysis results ──────────────────────────────────────

  test("accepts valid field analysis", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [validField],
      annotations: [validAnnotation],
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty fields and annotations", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [],
      annotations: [],
    });
    expect(result.success).toBe(true);
  });

  test("accepts all field types", () => {
    const fieldTypes = [
      "signature",
      "text",
      "number",
      "date",
      "checkbox",
      "dropdown",
      "radio",
      "attachment",
      "payment",
    ] as const;

    for (const fieldType of fieldTypes) {
      const result = DocumentAnalysisSchema.safeParse({
        fields: [{ ...validField, fieldType }],
        annotations: [],
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts all annotation categories", () => {
    const categories = ["obligation", "payment", "risk", "dates", "terms"] as const;

    for (const category of categories) {
      const result = DocumentAnalysisSchema.safeParse({
        fields: [],
        annotations: [{ ...validAnnotation, category }],
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts all severity levels", () => {
    const severities = ["informational", "important", "critical"] as const;

    for (const severity of severities) {
      const result = DocumentAnalysisSchema.safeParse({
        fields: [],
        annotations: [{ ...validAnnotation, severity }],
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts multiple fields on different pages", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [
        { ...validField, page: 1, label: "Buyer Signature" },
        { ...validField, page: 1, label: "Buyer Date", fieldType: "date", y: 85 },
        { ...validField, page: 3, label: "Seller Signature", y: 70 },
      ],
      annotations: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toHaveLength(3);
    }
  });

  // ─── Field coordinate validation ──────────────────────────────────

  test("rejects field x below 0", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, x: -1 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field x above 100", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, x: 101 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field y below 0", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, y: -5 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field y above 100", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, y: 105 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field width below 1", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, width: 0 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field width above 50", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, width: 51 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field height below 1", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, height: 0 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects field height above 20", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, height: 21 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  // ─── Field confidence ──────────────────────────────────────

  test("accepts confidence at boundaries (0 and 1)", () => {
    for (const confidence of [0, 0.5, 1]) {
      const result = DocumentAnalysisSchema.safeParse({
        fields: [{ ...validField, confidence }],
        annotations: [],
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects confidence below 0", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, confidence: -0.1 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects confidence above 1", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, confidence: 1.1 }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  // ─── Annotation validation ──────────────────────────────────

  test("rejects annotation with page 0", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [],
      annotations: [{ ...validAnnotation, page: 0 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects annotation summary over 120 chars", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [],
      annotations: [{ ...validAnnotation, summary: "x".repeat(121) }],
    });
    expect(result.success).toBe(false);
  });

  test("accepts annotation summary at exactly 120 chars", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [],
      annotations: [{ ...validAnnotation, summary: "x".repeat(120) }],
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid field type", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [{ ...validField, fieldType: "nonexistent" }],
      annotations: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid annotation category", () => {
    const result = DocumentAnalysisSchema.safeParse({
      fields: [],
      annotations: [{ ...validAnnotation, category: "other" }],
    });
    expect(result.success).toBe(false);
  });
});
