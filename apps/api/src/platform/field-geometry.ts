/**
 * Percent-of-page field geometry helpers (0–100), matching web FIELD_DIMENSIONS
 * on a letter PDF (~612×792). Used to turn markdown line candidates into
 * placeable fields for agents and the AI-suggest UI.
 */

export type PlaceableFieldType =
  | "signature"
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "dropdown"
  | "radio"
  | "attachment"
  | "payment";

export type FieldGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Default sizes as % of page — aligned with apps/web draggable-field.tsx */
const DEFAULT_SIZE: Record<
  PlaceableFieldType,
  { width: number; height: number }
> = {
  signature: { width: 33, height: 6 },
  text: { width: 30, height: 5 },
  number: { width: 30, height: 5 },
  date: { width: 23, height: 5 },
  checkbox: { width: 5, height: 4 },
  dropdown: { width: 30, height: 5 },
  radio: { width: 23, height: 5 },
  attachment: { width: 30, height: 6 },
  payment: { width: 36, height: 8 },
};

const LINES_PER_PAGE = 50;
const LEFT_MARGIN = 10;

/**
 * Map anydoc / heuristic candidate type strings onto Seal field types.
 */
export function mapCandidateTypeToFieldType(type: string): PlaceableFieldType {
  switch (type.toLowerCase()) {
    case "signature":
      return "signature";
    case "initials":
      return "text";
    case "date":
      return "date";
    case "name":
      return "text";
    case "checkbox":
      return "checkbox";
    case "number":
      return "number";
    case "dropdown":
      return "dropdown";
    case "radio":
      return "radio";
    case "attachment":
      return "attachment";
    case "payment":
      return "payment";
    case "text":
    default:
      return "text";
  }
}

/**
 * Estimate page-percent geometry from a markdown line index.
 * `line` is 0-based within the page content.
 */
export function geometryFromLine(
  fieldType: PlaceableFieldType,
  line: number
): FieldGeometry {
  const size = DEFAULT_SIZE[fieldType];
  const clampedLine = Math.max(0, line);
  const y = Math.min(
    100 - size.height,
    Math.round((clampedLine / LINES_PER_PAGE) * 90 * 10) / 10
  );
  return {
    x: LEFT_MARGIN,
    y,
    width: size.width,
    height: size.height,
  };
}

export function validateFieldGeometry(geometry: FieldGeometry): {
  valid: boolean;
  error?: string;
} {
  const { x, y, width, height } = geometry;
  if (x < 0 || x > 100) {
    return { valid: false, error: "X coordinate must be between 0 and 100" };
  }
  if (y < 0 || y > 100) {
    return { valid: false, error: "Y coordinate must be between 0 and 100" };
  }
  if (width <= 0 || width > 100) {
    return { valid: false, error: "Width must be between 0 and 100" };
  }
  if (height <= 0 || height > 100) {
    return { valid: false, error: "Height must be between 0 and 100" };
  }
  if (x + width > 100) {
    return { valid: false, error: "Field extends beyond right page boundary" };
  }
  if (y + height > 100) {
    return { valid: false, error: "Field extends beyond bottom page boundary" };
  }
  return { valid: true };
}

export function confidenceForCandidateType(type: string): number {
  switch (type.toLowerCase()) {
    case "signature":
      return 0.85;
    case "date":
      return 0.8;
    case "checkbox":
      return 0.75;
    case "name":
    case "initials":
      return 0.7;
    default:
      return 0.55;
  }
}
