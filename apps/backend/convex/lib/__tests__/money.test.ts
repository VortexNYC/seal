import { describe, expect, test } from "vitest";

import { parseMoneyToCents } from "../money";

describe("parseMoneyToCents", () => {
  test("parses $1,234.56 to 123456", () => {
    expect(parseMoneyToCents("$1,234.56")).toBe(123456);
  });

  test("parses $0.99 to 99", () => {
    expect(parseMoneyToCents("$0.99")).toBe(99);
  });

  test("parses $1,000 to 100000", () => {
    expect(parseMoneyToCents("$1,000")).toBe(100000);
  });

  test("parses $5 to 500", () => {
    expect(parseMoneyToCents("$5")).toBe(500);
  });

  test("parses -$2.50 to -250", () => {
    expect(parseMoneyToCents("-$2.50")).toBe(-250);
  });

  test("parses $1,234.5 to 123450", () => {
    expect(parseMoneyToCents("$1,234.5")).toBe(123450);
  });
});
