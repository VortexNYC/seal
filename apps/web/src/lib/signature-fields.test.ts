import { describe, expect, it } from "vitest";

import { type Doc } from "@/lib/convex-ids";

import { parseId } from "./convex-ids";
import { countSignatureFields } from "./signature-fields";

const buildField = (
  fieldType: string,
  idSuffix: string
): Doc<"signature_fields"> => ({
  _id: parseId("signature_fields", `field-${idSuffix}`),
  _creationTime: 0,
  documentId: parseId("documents", "doc-1"),
  recipientId: parseId("document_recipients", "recipient-1"),
  fieldType,
  label: `${fieldType} field`,
  isRequired: false,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  page: 1,
  createdAt: 0,
  updatedAt: 0,
});

describe("countSignatureFields", () => {
  it("returns 0 when there are no fields", () => {
    expect(countSignatureFields([])).toBe(0);
  });

  it("ignores non-signature field types", () => {
    const fields = [
      buildField("text", "text"),
      buildField("date", "date"),
      buildField("checkbox", "checkbox"),
    ];

    expect(countSignatureFields(fields)).toBe(0);
  });

  it("counts only signature field types when mixed", () => {
    const fields = [
      buildField("signature", "primary"),
      buildField("text", "text"),
      buildField("signature", "secondary"),
    ];

    expect(countSignatureFields(fields)).toBe(2);
  });
});
