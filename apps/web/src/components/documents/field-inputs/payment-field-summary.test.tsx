import { render, screen } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";

import type { Id } from "@seal/backend/convex/_generated/dataModel";

// Mock convex/react
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

// Mock PaymentFieldInline since it depends on Stripe
vi.mock("./payment-field-inline", () => ({
  PaymentFieldInline: () => <div data-testid="payment-inline-mock" />,
}));

import { PaymentFieldSummary } from "./payment-field-summary";

const FAKE_FIELD_ID = "fake_field_id" as Id<"signature_fields">;

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    _id: "config_123",
    paymentType: "one_time",
    items: [
      { id: "1", description: "Consulting fee", quantity: 1, unitPrice: 15000 },
      { id: "2", description: "Setup fee", quantity: 2, unitPrice: 5000 },
    ],
    totalAmountCents: 25000,
    currency: "usd",
    paymentStatus: "pending",
    ...overrides,
  };
}

describe("PaymentFieldSummary", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  test("shows loading spinner when query returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { container } = render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  test("shows 'Payment not yet configured' when query returns null", () => {
    mockUseQuery.mockReturnValue(null);

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("Payment not yet configured")).toBeInTheDocument();
  });

  test("renders line items with descriptions and amounts", () => {
    mockUseQuery.mockReturnValue(makeConfig());

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("Consulting fee")).toBeInTheDocument();
    expect(screen.getByText("Setup fee")).toBeInTheDocument();
    // Total: 25000 cents = $250.00
    expect(screen.getByText("$250.00")).toBeInTheDocument();
    // Payment type badge
    expect(screen.getByText("One-time")).toBeInTheDocument();
  });

  test("shows Paid status badge", () => {
    mockUseQuery.mockReturnValue(makeConfig({ paymentStatus: "paid" }));

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  test("shows Pay Now link when hostedInvoiceUrl is present and payment is awaiting", () => {
    mockUseQuery.mockReturnValue(
      makeConfig({
        paymentStatus: "awaiting",
        hostedInvoiceUrl: "https://invoice.stripe.com/test",
      }),
    );

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} showInlinePayment={false} />);

    const payNowLink = screen.getByRole("link");
    expect(payNowLink).toHaveAttribute("href", "https://invoice.stripe.com/test");
    expect(payNowLink).toHaveTextContent("Pay Now");
  });

  test("does not show Pay Now link when payment status is paid", () => {
    mockUseQuery.mockReturnValue(
      makeConfig({
        paymentStatus: "paid",
        hostedInvoiceUrl: "https://invoice.stripe.com/test",
      }),
    );

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} showInlinePayment={false} />);

    expect(screen.queryByText("Pay Now")).not.toBeInTheDocument();
  });

  test("shows quantity multiplier for items with quantity > 1", () => {
    mockUseQuery.mockReturnValue(
      makeConfig({
        items: [{ id: "1", description: "Widget", quantity: 3, unitPrice: 1000 }],
        totalAmountCents: 3000,
      }),
    );

    render(<PaymentFieldSummary fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("x3")).toBeInTheDocument();
  });
});
