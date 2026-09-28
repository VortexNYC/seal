/**
 * Typed field meta for the web editor — mirrors apps/api/src/platform/field-meta.ts.
 * Keep catalogs in sync when adding field types.
 */

import { z } from "zod";

import { FIELD_TYPES, type FieldType } from "./field-types";

export const ZFieldOverflowMode = z.enum([
  "auto",
  "horizontal",
  "vertical",
  "crop",
]);
export const ZFieldTextAlign = z.enum(["left", "center", "right"]);
export const ZFieldVerticalAlign = z.enum(["top", "middle", "bottom"]);

export const ZBaseFieldMeta = z.object({
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  helpText: z.string().optional(),
  fontSize: z.number().min(8).max(96).optional(),
  overflow: ZFieldOverflowMode.optional(),
});

const ZOptionList = z.array(z.string()).optional();

export const ZFieldMetaSchema = z.discriminatedUnion("type", [
  ZBaseFieldMeta.extend({
    type: z.literal("signature"),
    overflow: ZFieldOverflowMode.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("free_signature"),
    overflow: ZFieldOverflowMode.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("initials"),
    textAlign: ZFieldTextAlign.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("name"),
    textAlign: ZFieldTextAlign.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("email"),
    textAlign: ZFieldTextAlign.optional(),
    overflow: ZFieldOverflowMode.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("text"),
    text: z.string().optional(),
    characterLimit: z.number().min(0).optional(),
    textAlign: ZFieldTextAlign.optional(),
    lineHeight: z.number().min(1).max(10).optional(),
    letterSpacing: z.number().min(0).max(100).optional(),
    verticalAlign: ZFieldVerticalAlign.optional(),
    pattern: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("number"),
    numberFormat: z.string().nullish(),
    value: z.string().optional(),
    minValue: z.number().nullish(),
    maxValue: z.number().nullish(),
    textAlign: ZFieldTextAlign.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("date"),
    textAlign: ZFieldTextAlign.optional(),
    overflow: ZFieldOverflowMode.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("date_signed"),
    textAlign: ZFieldTextAlign.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("checkbox"),
    options: ZOptionList,
    allowMultiple: z.boolean().optional(),
    direction: z.enum(["vertical", "horizontal"]).optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("radio"),
    options: ZOptionList,
    direction: z.enum(["vertical", "horizontal"]).optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("dropdown"),
    options: ZOptionList,
    defaultValue: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("multi_select"),
    options: ZOptionList,
    direction: z.enum(["vertical", "horizontal"]).optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("attachment"),
    accept: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("image"),
    accept: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
  }),
  ZBaseFieldMeta.extend({ type: z.literal("payment") }),
  ZBaseFieldMeta.extend({
    type: z.literal("phone"),
    textAlign: ZFieldTextAlign.optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("cells"),
    cellCount: z.number().int().min(1).max(64).optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("stamp"),
    accept: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("heading"),
    textAlign: ZFieldTextAlign.optional(),
    text: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("strikethrough"),
    text: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("verification"),
    provider: z.string().optional(),
  }),
  ZBaseFieldMeta.extend({
    type: z.literal("kba"),
    provider: z.string().optional(),
    questionCount: z.number().int().min(1).max(10).optional(),
  }),
]);

export type TFieldMeta = z.infer<typeof ZFieldMetaSchema>;

export function parseFieldMeta(value: unknown): TFieldMeta | undefined {
  const result = ZFieldMetaSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function defaultFieldMeta(fieldType: FieldType): TFieldMeta | undefined {
  return parseFieldMeta({ type: fieldType });
}

/** Exhaustiveness guard — fails typecheck if FIELD_TYPES gains a member without meta. */
const _metaCoversCatalog: Record<FieldType, true> = {
  signature: true,
  free_signature: true,
  initials: true,
  name: true,
  email: true,
  text: true,
  number: true,
  date: true,
  date_signed: true,
  checkbox: true,
  radio: true,
  dropdown: true,
  multi_select: true,
  attachment: true,
  image: true,
  payment: true,
  phone: true,
  cells: true,
  stamp: true,
  heading: true,
  strikethrough: true,
  verification: true,
  kba: true,
};

void _metaCoversCatalog;
void FIELD_TYPES;
