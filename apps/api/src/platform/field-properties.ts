/**
 * Shared field-property helpers for binding_key (GitHub #604) + typed meta.
 * Agents bind fillable fields to external structured-data keys so the deal
 * writes the document instead of OCR reconstructing it.
 */

import {
  parseFieldMeta,
  type TFieldMeta,
  ZFieldPropertiesFlat,
} from "./field-meta.js";

export type FieldProperties = {
  placeholder?: string;
  default_value?: string;
  options?: string[];
  binding_key?: string;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  helpText?: string;
  cellCount?: number;
  /** Documenso-shaped typed meta when present. */
  meta?: TFieldMeta;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFieldProperties(
  value: string | null | undefined
): FieldProperties | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return undefined;

    const flat = ZFieldPropertiesFlat.safeParse(parsed);
    const source = flat.success ? flat.data : parsed;

    const properties: FieldProperties = {};
    if (typeof source.placeholder === "string") {
      properties.placeholder = source.placeholder;
    }
    const defaultValue = source.default_value ?? source.defaultValue;
    if (typeof defaultValue === "string") {
      properties.default_value = defaultValue;
    }
    if (
      Array.isArray(source.options) &&
      source.options.every((o) => typeof o === "string")
    ) {
      properties.options = source.options;
    }
    const bindingKey = source.binding_key ?? source.bindingKey;
    if (typeof bindingKey === "string" && bindingKey.length > 0) {
      properties.binding_key = bindingKey;
    }
    if (typeof source.maxLength === "number") {
      properties.maxLength = source.maxLength;
    }
    if (typeof source.minLength === "number") {
      properties.minLength = source.minLength;
    }
    if (typeof source.pattern === "string") {
      properties.pattern = source.pattern;
    }
    if (typeof source.helpText === "string") {
      properties.helpText = source.helpText;
    }
    if (typeof source.cellCount === "number") {
      properties.cellCount = source.cellCount;
    }

    const nestedMeta = source.meta ?? (parsed.type ? parsed : undefined);
    const meta = parseFieldMeta(nestedMeta);
    if (meta) {
      properties.meta = meta;
    }

    return Object.keys(properties).length > 0 ? properties : undefined;
  } catch {
    return undefined;
  }
}

export function mergeFieldProperties(
  existingJson: string | null | undefined,
  patch: FieldProperties
): string {
  const current = parseFieldProperties(existingJson) ?? {};
  const next: FieldProperties = { ...current };
  if (patch.placeholder !== undefined) next.placeholder = patch.placeholder;
  if (patch.default_value !== undefined)
    next.default_value = patch.default_value;
  if (patch.options !== undefined) next.options = patch.options;
  if (patch.maxLength !== undefined) next.maxLength = patch.maxLength;
  if (patch.minLength !== undefined) next.minLength = patch.minLength;
  if (patch.pattern !== undefined) next.pattern = patch.pattern;
  if (patch.helpText !== undefined) next.helpText = patch.helpText;
  if (patch.cellCount !== undefined) next.cellCount = patch.cellCount;
  if (patch.meta !== undefined) next.meta = patch.meta;
  if (patch.binding_key !== undefined) {
    if (patch.binding_key.length === 0) {
      delete next.binding_key;
    } else {
      next.binding_key = patch.binding_key;
    }
  }
  return JSON.stringify(next);
}

export function readBindingKey(
  propertiesJson: string | null | undefined
): string | undefined {
  return parseFieldProperties(propertiesJson)?.binding_key;
}

export { ZFieldPropertiesFlat } from "./field-meta.js";
