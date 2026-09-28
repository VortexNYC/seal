import { z } from "zod";

import { FIELD_TYPES } from "./field-types.js";

/**
 * Typed field meta — Documenso-shaped (discriminated by `type`), Seal field catalog.
 * Stored inside signature_fields.properties JSON alongside flat keys
 * (placeholder, binding_key, options, …).
 */

export const FIELD_OVERFLOW_MODES = [
  "auto",
  "horizontal",
  "vertical",
  "crop",
] as const;
export type FieldOverflowMode = (typeof FIELD_OVERFLOW_MODES)[number];

export const FIELD_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type FieldTextAlign = (typeof FIELD_TEXT_ALIGNS)[number];

export const FIELD_VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export type FieldVerticalAlign = (typeof FIELD_VERTICAL_ALIGNS)[number];

export const ZFieldOverflowMode = z.enum(FIELD_OVERFLOW_MODES);
export const ZFieldTextAlign = z.enum(FIELD_TEXT_ALIGNS);
export const ZFieldVerticalAlign = z.enum(FIELD_VERTICAL_ALIGNS);

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  helpText: z.string().optional(),
  fontSize: z.number().min(8).max(96).optional(),
  overflow: ZFieldOverflowMode.optional(),
});

export type TBaseFieldMeta = z.infer<typeof ZBaseFieldMeta>;

const ZOptionList = z.array(z.string()).optional();

export const ZSignatureFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("signature"),
  overflow: ZFieldOverflowMode.optional().default("auto"),
});

export const ZFreeSignatureFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("free_signature"),
  overflow: ZFieldOverflowMode.optional().default("auto"),
});

export const ZInitialsFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("initials"),
  textAlign: ZFieldTextAlign.optional(),
});

export const ZNameFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("name"),
  textAlign: ZFieldTextAlign.optional(),
});

export const ZEmailFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("email"),
  textAlign: ZFieldTextAlign.optional(),
  overflow: ZFieldOverflowMode.optional().default("auto"),
});

export const ZTextFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("text"),
  text: z.string().optional(),
  characterLimit: z.number().min(0).optional(),
  textAlign: ZFieldTextAlign.optional(),
  lineHeight: z.number().min(1).max(10).optional(),
  letterSpacing: z.number().min(0).max(100).optional(),
  verticalAlign: ZFieldVerticalAlign.optional(),
  pattern: z.string().optional(),
});

export const ZNumberFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("number"),
  numberFormat: z.string().nullish(),
  value: z.string().optional(),
  minValue: z.number().nullish(),
  maxValue: z.number().nullish(),
  textAlign: ZFieldTextAlign.optional(),
});

export const ZDateFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("date"),
  textAlign: ZFieldTextAlign.optional(),
  overflow: ZFieldOverflowMode.optional().default("auto"),
});

export const ZDateSignedFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("date_signed"),
  textAlign: ZFieldTextAlign.optional(),
});

export const ZCheckboxFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("checkbox"),
  options: ZOptionList,
  allowMultiple: z.boolean().optional(),
  direction: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
});

export const ZRadioFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("radio"),
  options: ZOptionList,
  direction: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
});

export const ZDropdownFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("dropdown"),
  options: ZOptionList,
  defaultValue: z.string().optional(),
});

export const ZMultiSelectFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("multi_select"),
  options: ZOptionList,
  direction: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
});

export const ZAttachmentFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("attachment"),
  accept: z.string().optional(),
  maxBytes: z.number().int().positive().optional(),
});

export const ZImageFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("image"),
  accept: z.string().optional().default("image/*"),
  maxBytes: z.number().int().positive().optional(),
});

export const ZPaymentFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("payment"),
});

export const ZPhoneFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("phone"),
  textAlign: ZFieldTextAlign.optional(),
});

export const ZCellsFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("cells"),
  cellCount: z.number().int().min(1).max(64).optional().default(6),
});

export const ZStampFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("stamp"),
  accept: z.string().optional().default("image/*"),
});

export const ZHeadingFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("heading"),
  textAlign: ZFieldTextAlign.optional(),
  text: z.string().optional(),
});

export const ZStrikethroughFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("strikethrough"),
  text: z.string().optional(),
});

export const ZVerificationFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("verification"),
  provider: z.string().optional(),
});

export const ZKbaFieldMeta = ZBaseFieldMeta.extend({
  type: z.literal("kba"),
  provider: z.string().optional(),
  questionCount: z.number().int().min(1).max(10).optional(),
});

export const ZFieldMetaSchema = z.discriminatedUnion("type", [
  ZSignatureFieldMeta,
  ZFreeSignatureFieldMeta,
  ZInitialsFieldMeta,
  ZNameFieldMeta,
  ZEmailFieldMeta,
  ZTextFieldMeta,
  ZNumberFieldMeta,
  ZDateFieldMeta,
  ZDateSignedFieldMeta,
  ZCheckboxFieldMeta,
  ZRadioFieldMeta,
  ZDropdownFieldMeta,
  ZMultiSelectFieldMeta,
  ZAttachmentFieldMeta,
  ZImageFieldMeta,
  ZPaymentFieldMeta,
  ZPhoneFieldMeta,
  ZCellsFieldMeta,
  ZStampFieldMeta,
  ZHeadingFieldMeta,
  ZStrikethroughFieldMeta,
  ZVerificationFieldMeta,
  ZKbaFieldMeta,
]);

export type TFieldMeta = z.infer<typeof ZFieldMetaSchema>;

/** Flat properties bag (legacy + binding) — still the wire format for most routes. */
export const ZFieldPropertiesFlat = z
  .object({
    placeholder: z.string().optional(),
    defaultValue: z.string().optional(),
    default_value: z.string().optional(),
    options: z.array(z.string()).optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    helpText: z.string().optional(),
    cellCount: z.number().int().optional(),
    bindingKey: z.string().optional(),
    binding_key: z.string().optional(),
    /** Optional nested typed meta (Documenso-style). */
    meta: ZFieldMetaSchema.optional(),
  })
  .partial()
  .passthrough();

export type TFieldPropertiesFlat = z.infer<typeof ZFieldPropertiesFlat>;

export function parseFieldMeta(value: unknown): TFieldMeta | undefined {
  const result = ZFieldMetaSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function fieldMetaForType(
  fieldType: (typeof FIELD_TYPES)[number],
  partial?: Record<string, unknown>
): TFieldMeta | undefined {
  return parseFieldMeta({ type: fieldType, ...partial });
}
