import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { render, screen } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";

// Mock convex/react
const mockUseQuery = vi.fn();
const mockMutate = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => mockMutate,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PaymentConfigModal } from "./payment-config-modal";

const FAKE_FIELD_ID = "fake_id" as Id<"signature_fields">;

describe("PaymentConfigModal", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockMutate.mockReset();
  });

  test("does not render dialog content when closed", () => {
    mockUseQuery.mockReturnValue(null);

    render(<PaymentConfigModal open={false} onOpenChange={vi.fn()} fieldId={null} />);

    expect(screen.queryByText("Configure Payment")).not.toBeInTheDocument();
  });

  test("renders loading spinner when config is loading", () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // Should show spinner, not the full form
    expect(screen.queryByText("Configure Payment")).not.toBeInTheDocument();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  test("renders full form when open with no existing config", () => {
    mockUseQuery.mockReturnValue(null);

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    expect(screen.getByText("Configure Payment")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Set up line items, payment terms, and accepted methods for this payment field.",
      ),
    ).toBeInTheDocument();
    // Tab labels
    expect(screen.getByText("Invoice Items")).toBeInTheDocument();
    expect(screen.getByText("Payment Terms")).toBeInTheDocument();
    expect(screen.getByText("Methods & Tax")).toBeInTheDocument();
    // Footer buttons
    expect(screen.getByText("Save Payment Config")).toBeInTheDocument();
  });

  test("shows total badge with correct amount from existing config", () => {
    mockUseQuery.mockReturnValue({
      paymentType: "one_time",
      items: [{ id: "1", description: "Consulting", quantity: 2, unitPrice: 7500 }],
      dueDateTerms: "on_receipt",
      currency: "usd",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
    });

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // 2 * $75.00 = $150.00
    expect(screen.getByText("Total: $150.00")).toBeInTheDocument();
  });
});
