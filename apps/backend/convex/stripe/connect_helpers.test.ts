import { describe, expect, test } from "vitest";

import { getConnectionStatus } from "./connect_helpers";

describe("Stripe Connect helpers", () => {
  test("returns pending when details are not submitted", () => {
    const status = getConnectionStatus({
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });

    expect(status).toBe("pending");
  });

  test("returns restricted when charges are disabled", () => {
    const status = getConnectionStatus({
      chargesEnabled: false,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
        disabledReason: "rejected.fraud",
      },
    });

    expect(status).toBe("restricted");
  });

  test("returns connected when charges and payouts are enabled", () => {
    const status = getConnectionStatus({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirements: {
        currentlyDue: [],
        eventuallyDue: [],
        pastDue: [],
      },
    });

    expect(status).toBe("connected");
  });
});
