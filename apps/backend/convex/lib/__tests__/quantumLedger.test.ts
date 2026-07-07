import { describe, expect, test } from "vitest";

import { computeLedgerBalance } from "../quantumLedger";

describe("computeLedgerBalance", () => {
  test("returns 0 for empty transactions array", () => {
    const result = computeLedgerBalance([]);
    expect(result).toBe(0);
  });

  test("sums transaction amounts correctly", () => {
    const result = computeLedgerBalance([{ amount: 10 }, { amount: -3 }, { amount: 5 }]);
    expect(result).toBe(12);
  });
});
