import { describe, expect, test } from "vitest";

import { validateAgainstRules, validateSignature } from "../helpers";

// ---------------------------------------------------------------------------
// validateSignature
// ---------------------------------------------------------------------------

describe("validateSignature", () => {
  // -- signature field type -------------------------------------------------
  describe('fieldType "signature"', () => {
    test("valid when signatureImageUrl is provided", () => {
      const result = validateSignature("signature", undefined, "https://example.com/sig.png");
      expect(result).toEqual({ valid: true });
    });

    test("invalid when signatureImageUrl is missing", () => {
      const result = validateSignature("signature", undefined, undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("invalid when signatureImageUrl is empty string", () => {
      const result = validateSignature("signature", "some value", "");
      expect(result.valid).toBe(false);
    });

    test("ignores value when signatureImageUrl is provided", () => {
      const result = validateSignature("signature", "", "https://example.com/sig.png");
      expect(result.valid).toBe(true);
    });
  });

  // -- initial field type ---------------------------------------------------
  describe('fieldType "initial"', () => {
    test("valid when signatureImageUrl is provided", () => {
      const result = validateSignature("initial", undefined, "https://example.com/init.png");
      expect(result).toEqual({ valid: true });
    });

    test("invalid when signatureImageUrl is missing", () => {
      const result = validateSignature("initial");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("image URL");
    });
  });

  // -- text field type ------------------------------------------------------
  describe('fieldType "text"', () => {
    test("valid with non-empty value", () => {
      expect(validateSignature("text", "hello")).toEqual({ valid: true });
    });

    test("invalid when value is undefined", () => {
      const result = validateSignature("text");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("text");
    });

    test("invalid when value is empty string", () => {
      const result = validateSignature("text", "");
      expect(result.valid).toBe(false);
    });

    test("invalid when value is whitespace only", () => {
      const result = validateSignature("text", "   ");
      expect(result.valid).toBe(false);
    });
  });

  // -- date field type ------------------------------------------------------
  describe('fieldType "date"', () => {
    test("valid with non-empty date string", () => {
      expect(validateSignature("date", "2026-01-15")).toEqual({ valid: true });
    });

    test("invalid when value is undefined", () => {
      const result = validateSignature("date");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("date");
    });

    test("invalid when value is empty string", () => {
      const result = validateSignature("date", "");
      expect(result.valid).toBe(false);
    });

    test("invalid when value is whitespace only", () => {
      const result = validateSignature("date", "  ");
      expect(result.valid).toBe(false);
    });
  });

  // -- checkbox field type --------------------------------------------------
  describe('fieldType "checkbox"', () => {
    test("always valid (can be unchecked)", () => {
      expect(validateSignature("checkbox")).toEqual({ valid: true });
      expect(validateSignature("checkbox", "true")).toEqual({ valid: true });
      expect(validateSignature("checkbox", "false")).toEqual({ valid: true });
      expect(validateSignature("checkbox", "")).toEqual({ valid: true });
    });
  });

  // -- dropdown field type --------------------------------------------------
  describe('fieldType "dropdown"', () => {
    test("valid with a selection", () => {
      expect(validateSignature("dropdown", "option1")).toEqual({ valid: true });
    });

    test("invalid when value is undefined", () => {
      const result = validateSignature("dropdown");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("selection");
    });

    test("invalid when value is empty string", () => {
      const result = validateSignature("dropdown", "");
      expect(result.valid).toBe(false);
    });

    test("invalid when value is whitespace only", () => {
      const result = validateSignature("dropdown", "   ");
      expect(result.valid).toBe(false);
    });
  });

  // -- radio field type -----------------------------------------------------
  describe('fieldType "radio"', () => {
    test("valid with a selection", () => {
      expect(validateSignature("radio", "optionA")).toEqual({ valid: true });
    });

    test("invalid when value is undefined", () => {
      const result = validateSignature("radio");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("selection");
    });

    test("invalid when value is empty string", () => {
      const result = validateSignature("radio", "");
      expect(result.valid).toBe(false);
    });
  });

  // -- unknown / other field types ------------------------------------------
  describe("unknown field types", () => {
    test("valid by default for unrecognized types", () => {
      expect(validateSignature("custom_field", "anything")).toEqual({ valid: true });
      expect(validateSignature("unknown")).toEqual({ valid: true });
    });
  });
});

// ---------------------------------------------------------------------------
// validateAgainstRules
// ---------------------------------------------------------------------------

describe("validateAgainstRules", () => {
  // -- no rules -------------------------------------------------------------
  describe("no rules", () => {
    test("valid when rules are undefined", () => {
      expect(validateAgainstRules("anything")).toEqual({ valid: true });
    });

    test("valid when rules are an empty object", () => {
      expect(validateAgainstRules("anything", {})).toEqual({ valid: true });
    });

    test("valid with undefined value and no rules", () => {
      expect(validateAgainstRules(undefined)).toEqual({ valid: true });
    });
  });

  // -- required rule --------------------------------------------------------
  describe("required rule", () => {
    test("valid when required and value is present", () => {
      const result = validateAgainstRules("hello", { required: true });
      expect(result.valid).toBe(true);
    });

    test("invalid when required and value is undefined", () => {
      const result = validateAgainstRules(undefined, { required: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("invalid when required and value is empty string", () => {
      const result = validateAgainstRules("", { required: true });
      expect(result.valid).toBe(false);
    });

    test("invalid when required and value is whitespace only", () => {
      const result = validateAgainstRules("   ", { required: true });
      expect(result.valid).toBe(false);
    });

    test("valid when not required and value is empty", () => {
      const result = validateAgainstRules("", { required: false });
      expect(result.valid).toBe(true);
    });

    test("uses customMessage for required error", () => {
      const result = validateAgainstRules("", {
        required: true,
        customMessage: "Please fill this in",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Please fill this in");
    });
  });

  // -- min length rule ------------------------------------------------------
  describe("min length rule", () => {
    test("valid when value meets min length", () => {
      const result = validateAgainstRules("hello", { min: 5 });
      expect(result.valid).toBe(true);
    });

    test("valid when value exceeds min length", () => {
      const result = validateAgainstRules("hello world", { min: 5 });
      expect(result.valid).toBe(true);
    });

    test("invalid when value is shorter than min length", () => {
      const result = validateAgainstRules("hi", { min: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum length");
      expect(result.error).toContain("5");
    });

    test("valid when value is undefined (not required)", () => {
      const result = validateAgainstRules(undefined, { min: 5 });
      expect(result.valid).toBe(true);
    });

    test("min of 0 allows empty string after required check passes", () => {
      const result = validateAgainstRules("", { min: 0 });
      // empty string is falsy, so the `if (!value) return valid` branch fires
      expect(result.valid).toBe(true);
    });

    test("uses customMessage for min length error", () => {
      const result = validateAgainstRules("hi", {
        min: 5,
        customMessage: "Too short!",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Too short!");
    });
  });

  // -- max length rule ------------------------------------------------------
  describe("max length rule", () => {
    test("valid when value is within max length", () => {
      const result = validateAgainstRules("hi", { max: 10 });
      expect(result.valid).toBe(true);
    });

    test("valid when value is exactly at max length", () => {
      const result = validateAgainstRules("hello", { max: 5 });
      expect(result.valid).toBe(true);
    });

    test("invalid when value exceeds max length", () => {
      const result = validateAgainstRules("hello world", { max: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum length");
      expect(result.error).toContain("5");
    });

    test("uses customMessage for max length error", () => {
      const result = validateAgainstRules("hello world", {
        max: 5,
        customMessage: "Way too long",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Way too long");
    });
  });

  // -- pattern rule ---------------------------------------------------------
  describe("pattern rule", () => {
    test("valid when value matches pattern", () => {
      const result = validateAgainstRules("abc123", { pattern: "^[a-z0-9]+$" });
      expect(result.valid).toBe(true);
    });

    test("invalid when value does not match pattern", () => {
      const result = validateAgainstRules("ABC!", { pattern: "^[a-z0-9]+$" });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("pattern");
    });

    test("uses customMessage for pattern error", () => {
      const result = validateAgainstRules("ABC!", {
        pattern: "^[a-z0-9]+$",
        customMessage: "Only lowercase alphanumeric allowed",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Only lowercase alphanumeric allowed");
    });

    test("valid when value is undefined (not required)", () => {
      const result = validateAgainstRules(undefined, { pattern: "^\\d+$" });
      expect(result.valid).toBe(true);
    });

    test("email pattern validation", () => {
      const emailPattern = "^[^@]+@[^@]+\\.[^@]+$";
      expect(validateAgainstRules("user@example.com", { pattern: emailPattern }).valid).toBe(true);
      expect(validateAgainstRules("not-an-email", { pattern: emailPattern }).valid).toBe(false);
    });
  });

  // -- combined rules -------------------------------------------------------
  describe("combined rules", () => {
    test("required + min + max: valid value passes all", () => {
      const result = validateAgainstRules("hello", {
        required: true,
        min: 3,
        max: 10,
      });
      expect(result.valid).toBe(true);
    });

    test("required fails before min/max are checked", () => {
      const result = validateAgainstRules("", {
        required: true,
        min: 3,
        max: 10,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("This field is required");
    });

    test("min length fails before pattern is checked", () => {
      const result = validateAgainstRules("ab", {
        min: 5,
        pattern: "^[a-z]+$",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Minimum length");
    });

    test("max length fails before pattern is checked", () => {
      const result = validateAgainstRules("abcdefghijk", {
        max: 5,
        pattern: "^[a-z]+$",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Maximum length");
    });

    test("all rules pass with valid value", () => {
      const result = validateAgainstRules("abc123", {
        required: true,
        min: 3,
        max: 10,
        pattern: "^[a-z0-9]+$",
      });
      expect(result.valid).toBe(true);
    });

    test("customMessage applies to whichever rule fails first", () => {
      const result = validateAgainstRules("", {
        required: true,
        min: 3,
        customMessage: "Custom error",
      });
      expect(result.error).toBe("Custom error");
    });
  });
});
