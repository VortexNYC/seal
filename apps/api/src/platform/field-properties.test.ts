import { describe, expect, test } from "vitest";

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
});
