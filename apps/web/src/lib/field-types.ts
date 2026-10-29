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
  // Wide enough for the icon and one line of the type name. Letter page is 612×792.
  signature: { width: 102, height: 28 },
  free_signature: { width: 142, height: 28 },
  initials: { width: 96, height: 28 },
  name: { width: 72, height: 28 },
  // 208px on a letter page fits a long address on one line at 12pt.
  email: { width: 208, height: 28 },
  text: { width: 68, height: 28 },
  number: { width: 84, height: 28 },
  date: { width: 70, height: 28 },
  date_signed: { width: 116, height: 28 },
  checkbox: { width: 28, height: 28 },
  radio: { width: 74, height: 28 },
  dropdown: { width: 100, height: 28 },
  multi_select: { width: 180, height: 48 },
  attachment: { width: 180, height: 44 },
  image: { width: 120, height: 80 },
  payment: { width: 220, height: 60 },
  phone: { width: 78, height: 28 },
  cells: { width: 72, height: 28 },
  stamp: { width: 100, height: 100 },
  heading: { width: 96, height: 28 },
  strikethrough: { width: 180, height: 24 },
  verification: { width: 180, height: 44 },
  kba: { width: 180, height: 44 },
};

export function isFieldType(value: string): value is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(value);
}
