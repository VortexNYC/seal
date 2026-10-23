/**
 * Percent-of-page field geometry helpers (0–100), matching web FIELD_DIMENSIONS
 * on a letter PDF (~612×792). Used to turn markdown line candidates into
 * placeable fields for agents and the AI-suggest UI.
 */

import {
  DEFAULT_FIELD_SIZE_PERCENT,
  type FieldType,
  mapCandidateTypeToFieldType as mapCandidate,
} from "./field-types";

export type PlaceableFieldType = FieldType;

export type FieldGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const LINES_PER_PAGE = 50;
const LEFT_MARGIN = 10;

/** Field types whose ink sits on a printed rule — line index ≈ field BOTTOM. */
const LINE_BOTTOM_ANCHORED = new Set<PlaceableFieldType>([
  "signature",
  "free_signature",
  "initials",
  "stamp",
]);

export {
  mapCandidateTypeToFieldType,
} from "./field-types";

/**
 * Estimate page-percent geometry from a markdown line index.
 * `line` is 0-based within the page content.
 * For signature-like fields, the line is treated as the rule the ink sits on
 * (field bottom), matching burn-in bottom-align behavior.
 */
export function geometryFromLine(
  fieldType: PlaceableFieldType,
  line: number
): FieldGeometry {
  const size = DEFAULT_FIELD_SIZE_PERCENT[fieldType];
  const clampedLine = Math.max(0, line);
  const lineY =
    Math.round((clampedLine / LINES_PER_PAGE) * 90 * 10) / 10;
  const y = LINE_BOTTOM_ANCHORED.has(fieldType)
    ? Math.max(0, Math.min(100 - size.height, lineY - size.height))
    : Math.min(100 - size.height, lineY);
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
  switch (mapCandidate(type)) {
    case "signature":
    case "free_signature":
      return 0.85;
    case "date":
    case "date_signed":
      return 0.8;
    case "checkbox":
      return 0.75;
    case "name":
    case "initials":
    case "email":
      return 0.7;
    default:
      return 0.55;
  }
}
