import { z } from "zod";

/**
 * Canonical Seal field types — union of Documenso + DocuSeal placeable types.
 * Keep in sync with apps/web/src/lib/field-types.ts and openapi FieldType.
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

export const FieldTypeEnum = z.enum(FIELD_TYPES);

/** Default sizes as % of page — letter PDF (~612×792) */
export const DEFAULT_FIELD_SIZE_PERCENT: Record<
  FieldType,
  { width: number; height: number }
> = {
  // Height kept short so the field bottom can sit on a printed signature rule.
  signature: { width: 33, height: 5 },
  free_signature: { width: 33, height: 5 },
  initials: { width: 13, height: 4 },
  name: { width: 30, height: 5 },
  email: { width: 33, height: 5 },
  text: { width: 30, height: 5 },
  number: { width: 30, height: 5 },
  date: { width: 23, height: 5 },
  date_signed: { width: 23, height: 5 },
  checkbox: { width: 5, height: 4 },
  radio: { width: 23, height: 5 },
  dropdown: { width: 30, height: 5 },
  multi_select: { width: 30, height: 7 },
  attachment: { width: 30, height: 6 },
  image: { width: 20, height: 10 },
  payment: { width: 36, height: 8 },
  phone: { width: 26, height: 5 },
  cells: { width: 36, height: 5 },
  stamp: { width: 16, height: 12 },
  heading: { width: 40, height: 5 },
  strikethrough: { width: 30, height: 3 },
  verification: { width: 30, height: 6 },
  kba: { width: 30, height: 6 },
};

export function mapCandidateTypeToFieldType(type: string): FieldType {
  switch (type.toLowerCase()) {
    case "signature":
    case "free_signature":
      return type.toLowerCase() === "free_signature"
        ? "free_signature"
        : "signature";
    case "initials":
      return "initials";
    case "name":
      return "name";
    case "email":
      return "email";
    case "date":
      return "date";
    case "date_signed":
    case "datenow":
      return "date_signed";
    case "checkbox":
      return "checkbox";
    case "number":
      return "number";
    case "dropdown":
    case "select":
      return "dropdown";
    case "multi_select":
    case "multiple":
      return "multi_select";
    case "radio":
      return "radio";
    case "attachment":
    case "file":
      return "attachment";
    case "image":
      return "image";
    case "payment":
      return "payment";
    case "phone":
      return "phone";
    case "cells":
      return "cells";
    case "stamp":
      return "stamp";
    case "heading":
      return "heading";
    case "strikethrough":
    case "strikeout":
      return "strikethrough";
    case "verification":
      return "verification";
    case "kba":
      return "kba";
    case "text":
    default:
      return "text";
  }
}
