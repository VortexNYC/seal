import { describe, expect, it } from "vitest";

import { filledFieldText, signatureMarkFrame } from "./field-appearance";

describe("filled field text", () => {
  it("shows a calendar day instead of a timestamp", () => {
    expect(filledFieldText("date", "2026-10-06T04:00:00.000Z")).toBe(
      "10/06/2026"
    );
    expect(filledFieldText("date_signed", "2026-10-12")).toBe("10/12/2026");
  });

  it("shows the address and a checkbox mark", () => {
    expect(filledFieldText("email", "seal-e2e@seal.nyc")).toBe(
      "seal-e2e@seal.nyc"
    );
    expect(filledFieldText("checkbox", '["Yes"]')).toBe("X");
    expect(filledFieldText("text", "Agreed")).toBe("Agreed");
  });

  it("grows a short signature chip up from the rule", () => {
    const frame = signatureMarkFrame(
      { width: 46, height: 13 },
      { width: 612, height: 792 }
    );
    expect(frame.width).toBeGreaterThanOrEqual(168);
    expect(frame.height).toBeGreaterThanOrEqual(36);
    expect(frame.y).toBeLessThan(0);
  });
});
