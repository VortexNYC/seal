import { describe, expect, test } from "vitest";

import { diffSyncKeys } from "./sync_external_data";

describe("diffSyncKeys", () => {
  test("returns added keys when items are added", () => {
    const result = diffSyncKeys(["a", "b"], ["a", "b", "c", "d"]);
    expect(result).toEqual({ added: ["c", "d"], removed: [] });
  });

  test("returns removed keys when items are removed", () => {
    const result = diffSyncKeys(["a", "b", "c"], ["a"]);
    expect(result).toEqual({ added: [], removed: ["b", "c"] });
  });

  test("returns both added and removed when keys change", () => {
    const result = diffSyncKeys(["a", "b", "c"], ["b", "d", "e"]);
    expect(result).toEqual({ added: ["d", "e"], removed: ["a", "c"] });
  });

  test("returns empty arrays when both inputs are empty", () => {
    const result = diffSyncKeys([], []);
    expect(result).toEqual({ added: [], removed: [] });
  });

  test("returns empty arrays when arrays are identical", () => {
    const result = diffSyncKeys(["x", "y", "z"], ["x", "y", "z"]);
    expect(result).toEqual({ added: [], removed: [] });
  });

  test("handles out-of-order input and produces stable sorted output", () => {
    const result = diffSyncKeys(["z", "a"], ["m", "a", "b"]);
    expect(result).toEqual({ added: ["b", "m"], removed: ["z"] });
  });

  test("ignores duplicates within each array", () => {
    const result = diffSyncKeys(["a", "a", "b"], ["a", "c", "c"]);
    expect(result).toEqual({ added: ["c"], removed: ["b"] });
  });
});
