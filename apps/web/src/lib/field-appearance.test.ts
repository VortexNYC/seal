import { describe, expect, it } from "vitest";

import {
  filledFieldText,
  signatureCaptionOffset,
  signatureMarkFrame,
  signatureStamp,
} from "./field-appearance";

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

  it("widens a short signature along the rule and keeps its height", () => {
    const frame = signatureMarkFrame(
      { width: 46, height: 13 },
      { width: 612, height: 792 }
    );
    expect(frame.width).toBeGreaterThanOrEqual(140);
    expect(frame.height).toBe(13);
    expect(frame.y).toBe(0);
    expect(signatureCaptionOffset(frame.height)).toBe(0);
    expect(signatureCaptionOffset(24)).toBe(-11);
  });

  it("stamps a short document id under the name", () => {
    expect(signatureStamp("bb91c6f9-dd96-4540-9148-f36033570dd2")).toBe(
      "BB91C6F9DD96"
    );
  });
});
