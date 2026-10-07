import { describe, expect, it } from "vitest";

import { filledFieldText } from "./field-appearance";

describe("filled field text", () => {
  it("shows a calendar day instead of a timestamp", () => {
    expect(filledFieldText("date", "2026-10-06T04:00:00.000Z")).toBe(
      "Oct 6, 2026"
    );
    expect(filledFieldText("date_signed", "2026-10-06")).toBe("Oct 6, 2026");
  });

  it("shows the address and a checkbox mark", () => {
    expect(filledFieldText("email", "seal-e2e@seal.nyc")).toBe(
      "seal-e2e@seal.nyc"
    );
    expect(filledFieldText("checkbox", '["Yes"]')).toBe("X");
    expect(filledFieldText("text", "Agreed")).toBe("Agreed");
  });
});
