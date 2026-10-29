import { describe, expect, it } from "vitest";

import { payNowHref } from "./pay-now";

describe("payNowHref", () => {
  it("accepts only an https pay link", () => {
    expect(payNowHref("https://pay.vortex.nyc/abc")).toBe(
      "https://pay.vortex.nyc/abc"
    );
    expect(payNowHref(null)).toBeNull();
    expect(payNowHref("http://pay.vortex.nyc/abc")).toBeNull();
  });
});
