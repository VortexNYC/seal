/// @vitest-environment jsdom

import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
  afterEach(cleanup);

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

  test("renders without crashing when existing config has customDueDate", () => {
    mockUseQuery.mockReturnValue({
      paymentType: "one_time",
      items: [{ id: "1", description: "Design services", quantity: 1, unitPrice: 500000 }],
      dueDateTerms: "custom",
      customDueDate: "2026-04-01",
      currency: "usd",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
    });

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // Title appears in both the visible heading and aria-label — just confirm one exists
    expect(screen.getAllByText("Configure Payment").length).toBeGreaterThan(0);
    expect(screen.getByText("Total: $5,000.00")).toBeInTheDocument();
  });

  test("when dueDateTerms is custom, both mode toggle buttons are in the DOM", async () => {
    mockUseQuery.mockReturnValue({
      paymentType: "one_time",
      items: [{ id: "1", description: "Service", quantity: 1, unitPrice: 100000 }],
      dueDateTerms: "custom",
      customDueDays: 45,
      currency: "usd",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
    });

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // Create user after render so DOM is ready
    const user = userEvent.setup();

    // Navigate to Payment Terms tab — Radix UI Tabs renders inactive content as null
    await user.click(screen.getByRole("tab", { name: "Payment Terms" }));

    expect(screen.getByText("Days from signing")).toBeInTheDocument();
    expect(screen.getByText("Specific date")).toBeInTheDocument();
  });

  test("when customDueDateMode is date, calendar trigger is shown instead of days input", async () => {
    // Config with customDueDate puts modal into "date" mode
    mockUseQuery.mockReturnValue({
      paymentType: "one_time",
      items: [{ id: "1", description: "Service", quantity: 1, unitPrice: 100000 }],
      dueDateTerms: "custom",
      customDueDate: "2026-06-15",
      currency: "usd",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
    });

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // Create user after render so DOM is ready
    const user = userEvent.setup();

    // Navigate to Payment Terms tab — Radix UI Tabs renders inactive content as null
    await user.click(screen.getByRole("tab", { name: "Payment Terms" }));

    // "Pick a date" placeholder should NOT appear — a real date is loaded
    expect(screen.queryByText("Pick a date")).not.toBeInTheDocument();
    // Both mode toggles are present
    expect(screen.getByText("Days from signing")).toBeInTheDocument();
    expect(screen.getByText("Specific date")).toBeInTheDocument();
  });

  test("loads customDueDate from existing config and displays the formatted date", async () => {
    mockUseQuery.mockReturnValue({
      paymentType: "one_time",
      items: [{ id: "1", description: "Service", quantity: 1, unitPrice: 100000 }],
      dueDateTerms: "custom",
      customDueDate: "2026-04-01",
      currency: "usd",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
    });

    render(<PaymentConfigModal open={true} onOpenChange={vi.fn()} fieldId={FAKE_FIELD_ID} />);

    // Create user after render so DOM is ready
    const user = userEvent.setup();

    // Navigate to Payment Terms tab — Radix UI Tabs renders inactive content as null
    await user.click(screen.getByRole("tab", { name: "Payment Terms" }));

    // date-fns "PPP" format in enUS produces "April 1st, 2026" (with ordinal)
    expect(screen.getByText("April 1st, 2026")).toBeInTheDocument();
    expect(screen.queryByText("Pick a date")).not.toBeInTheDocument();
  });
});
