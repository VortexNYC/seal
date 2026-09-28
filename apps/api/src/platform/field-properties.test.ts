import { describe, expect, test } from "vitest";

import {
  fieldMetaForType,
  parseFieldMeta,
  ZFieldMetaSchema,
} from "./field-meta.js";
import {
  mergeFieldProperties,
  parseFieldProperties,
  readBindingKey,
} from "./field-properties.js";

describe("field-properties", () => {
  test("parses binding_key and default_value aliases", () => {
    const props = parseFieldProperties(
      JSON.stringify({
        bindingKey: "proposal.amount",
        defaultValue: "100",
      })
    );
    expect(props).toEqual({
      binding_key: "proposal.amount",
      default_value: "100",
    });
    expect(readBindingKey(JSON.stringify({ binding_key: "x" }))).toBe("x");
  });

  test("merges binding_key patches and clears empty keys", () => {
    const merged = mergeFieldProperties(
      JSON.stringify({ placeholder: "hi", binding_key: "old" }),
      { binding_key: "new", default_value: "42" }
    );
    expect(JSON.parse(merged)).toEqual({
      placeholder: "hi",
      binding_key: "new",
      default_value: "42",
    });

    const cleared = mergeFieldProperties(merged, { binding_key: "" });
    expect(JSON.parse(cleared).binding_key).toBeUndefined();
  });

  test("preserves typed meta on parse/merge", () => {
    const withMeta = mergeFieldProperties(null, {
      placeholder: "JD",
      meta: fieldMetaForType("initials", { textAlign: "center" }),
    });
    const parsed = parseFieldProperties(withMeta);
    expect(parsed?.placeholder).toBe("JD");
    expect(parsed?.meta).toMatchObject({
      type: "initials",
      textAlign: "center",
    });
  });
});

describe("field-meta", () => {
  test("discriminated union covers Seal field catalog", () => {
    expect(ZFieldMetaSchema.parse({ type: "signature" }).type).toBe(
      "signature"
    );
    const cells = ZFieldMetaSchema.parse({ type: "cells", cellCount: 8 });
    expect(cells.type).toBe("cells");
    if (cells.type === "cells") {
      expect(cells.cellCount).toBe(8);
    }
    expect(parseFieldMeta({ type: "nope" })).toBeUndefined();
  });

  test("fieldMetaForType builds typed defaults", () => {
    expect(fieldMetaForType("phone")).toMatchObject({ type: "phone" });
    expect(fieldMetaForType("date_signed")).toMatchObject({
      type: "date_signed",
    });
  });
});
