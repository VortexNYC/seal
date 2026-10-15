import { describe, expect, it } from "vitest";

import { paymentFieldBlockedReason } from "./field-toolbar";

describe("paymentFieldBlockedReason", () => {
  it("blocks placement until Vortex approves charges", () => {
    expect(paymentFieldBlockedReason(false)).toBe(
      "Vortex has to approve charges before a payment field can be placed."
    );
    expect(paymentFieldBlockedReason(true)).toBeNull();
  });
});
