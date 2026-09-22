/**
 * Shared field-property helpers for binding_key (GitHub #604).
 * Agents bind fillable fields to external structured-data keys so the deal
 * writes the document instead of OCR reconstructing it.
 */

export type FieldProperties = {
  placeholder?: string;
  default_value?: string;
  options?: string[];
  binding_key?: string;
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
    const properties: FieldProperties = {};
    if (typeof parsed.placeholder === "string") {
      properties.placeholder = parsed.placeholder;
    }
    const defaultValue = parsed.default_value ?? parsed.defaultValue;
    if (typeof defaultValue === "string") {
      properties.default_value = defaultValue;
    }
    if (
      Array.isArray(parsed.options) &&
      parsed.options.every((o) => typeof o === "string")
    ) {
      properties.options = parsed.options;
    }
    const bindingKey = parsed.binding_key ?? parsed.bindingKey;
    if (typeof bindingKey === "string" && bindingKey.length > 0) {
      properties.binding_key = bindingKey;
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
