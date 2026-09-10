import { cleanup, render, screen } from "@testing-library/react";
import { describe, test, expect, afterEach } from "vitest";

import { PaymentFieldSummary } from "./payment-field-summary";

const FAKE_FIELD_ID = "fake_field_id";

describe("PaymentFieldSummary", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the Vortex Payments placeholder", () => {
    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("Payment collection")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Payment fields are managed in Vortex Payments. The summary will be restored once payment data is available."
      )
    ).toBeInTheDocument();
  });
});
