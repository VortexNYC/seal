/**
 * Canonical Seal field types — union of Documenso + DocuSeal placeable types.
 * Keep in sync with apps/api/src/platform/field-types.ts and openapi FieldType.
 */

export const FIELD_TYPES = [
  "signature",
  "free_signature",
  "initials",
  "name",
  "email",
  "text",
  "number",
  "date",
  "date_signed",
  "checkbox",
  "radio",
  "dropdown",
  "multi_select",
  "attachment",
  "image",
  "payment",
  "phone",
  "cells",
  "stamp",
  "heading",
  "strikethrough",
  "verification",
  "kba",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  signature: "Signature",
  free_signature: "Free signature",
  initials: "Initials",
  name: "Name",
  email: "Email",
  text: "Text",
  number: "Number",
  date: "Date",
  date_signed: "Date signed",
  checkbox: "Checkbox",
  radio: "Radio",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  attachment: "File",
  image: "Image",
  payment: "Payment",
  phone: "Phone",
  cells: "Cells",
  stamp: "Stamp",
  heading: "Heading",
  strikethrough: "Strikeout",
  verification: "ID verify",
  kba: "KBA",
};

/** Default canvas dimensions (px) for placement */
export const FIELD_DIMENSIONS: Record<
  FieldType,
  { width: number; height: number }
> = {
  // ~33%×5% / ~13%×4% of letter page — short so ink sits on the rule.
  signature: { width: 200, height: 40 },
  free_signature: { width: 200, height: 40 },
  initials: { width: 80, height: 32 },
  name: { width: 180, height: 36 },
  email: { width: 200, height: 36 },
  text: { width: 180, height: 36 },
  number: { width: 180, height: 36 },
  date: { width: 140, height: 36 },
  date_signed: { width: 140, height: 36 },
  checkbox: { width: 28, height: 28 },
  radio: { width: 140, height: 36 },
  dropdown: { width: 180, height: 36 },
  multi_select: { width: 180, height: 48 },
  attachment: { width: 180, height: 44 },
  image: { width: 120, height: 80 },
  payment: { width: 220, height: 60 },
  phone: { width: 160, height: 36 },
  cells: { width: 220, height: 36 },
  stamp: { width: 100, height: 100 },
  heading: { width: 240, height: 36 },
  strikethrough: { width: 180, height: 24 },
  verification: { width: 180, height: 44 },
  kba: { width: 180, height: 44 },
};

export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}
