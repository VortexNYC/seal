import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Id } from "@seal/backend/convex/_generated/dataModel";

// Mock convex/react — must be hoisted before importing the component
const mockUseAction = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockUseAction,
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SendDocumentDialog } from "./send-document-dialog";

const FAKE_DOC_ID = "fake_doc" as Id<"documents">;
const FAKE_RECIPIENT_ID = "fake_recip" as Id<"document_recipients">;
const FAKE_RECIPIENT_ID_2 = "fake_recip_2" as Id<"document_recipients">;

interface BuildPropsOptions {
  open?: boolean;
  signatureFieldCount?: number;
  recipients?: Array<{
    _id: Id<"document_recipients">;
    name?: string;
    email: string;
    role: "signer" | "viewer" | "approver";
    status: "pending" | "viewed" | "signed" | "approved" | "declined";
  }>;
  fieldCountsByRecipient?: Map<string, number>;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

function buildProps(overrides: BuildPropsOptions = {}) {
  return {
    documentId: FAKE_DOC_ID,
    documentName: "Test Document",
    recipients: [
      {
        _id: FAKE_RECIPIENT_ID,
        name: "Alice Smith",
        email: "alice@example.com",
        role: "signer" as const,
        status: "pending" as const,
      },
    ],
    signatureFieldCount: 2,
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
}

describe("SendDocumentDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseAction.mockReset();
    // Default: no payment configs
    mockUseQuery.mockReturnValue([]);
  });

  test("does not render dialog content when open is false", () => {
    render(<SendDocumentDialog {...buildProps({ open: false })} />);
    expect(screen.queryByText("Send Document")).not.toBeInTheDocument();
  });

  test("renders dialog title 'Send Document' when open is true", () => {
    render(<SendDocumentDialog {...buildProps({ open: true })} />);
    // The title is an <h2> with data-slot="dialog-title"; use heading role to distinguish
    // it from the "Send Document" button text also present in the DOM.
    expect(screen.getByRole("heading", { name: "Send Document" })).toBeInTheDocument();
  });

  test("shows error when signatureFieldCount is 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 0 })} />);
    expect(screen.getByText("Cannot send document without signature fields.")).toBeInTheDocument();
  });

  test("does not show signature field error when signatureFieldCount > 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 1 })} />);
    expect(
      screen.queryByText("Cannot send document without signature fields."),
    ).not.toBeInTheDocument();
  });

  test("Send button text shows 'Send Document'", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByRole("button", { name: /Send Document/i })).toBeInTheDocument();
  });

  test("Send button is disabled when signatureFieldCount is 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 0 })} />);
    const button = screen.getByRole("button", { name: /Send Document/i });
    expect(button).toBeDisabled();
  });

  test("Send button is enabled when signatureFieldCount > 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 2 })} />);
    const button = screen.getByRole("button", { name: /Send Document/i });
    expect(button).not.toBeDisabled();
  });

  test("shows info box about email links when signatureFieldCount > 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 1 })} />);
    expect(
      screen.getByText(/Recipients will receive an email with a link to sign the document/i),
    ).toBeInTheDocument();
  });

  test("does not show email info box when signatureFieldCount is 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 0 })} />);
    expect(
      screen.queryByText(/Recipients will receive an email with a link to sign the document/i),
    ).not.toBeInTheDocument();
  });

  test("shows payment summary when paymentConfigs has items", () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "cfg_1" as Id<"payment_field_configs">,
        currency: "usd",
        totalAmountCents: 5000,
      },
    ]);

    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByText("Payment will be included")).toBeInTheDocument();
  });

  test("shows correct singular payment text for a single payment config", () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "cfg_1" as Id<"payment_field_configs">,
        currency: "usd",
        totalAmountCents: 10000,
      },
    ]);

    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByText("Payment will be included")).toBeInTheDocument();
    // $100.00 USD formatted
    expect(screen.getByText("$100.00 USD")).toBeInTheDocument();
  });

  test("shows correct plural payment text for multiple payment configs", () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "cfg_1" as Id<"payment_field_configs">,
        currency: "usd",
        totalAmountCents: 5000,
      },
      {
        _id: "cfg_2" as Id<"payment_field_configs">,
        currency: "usd",
        totalAmountCents: 2500,
      },
    ]);

    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByText("2 payments will be included")).toBeInTheDocument();
  });

  test("does not show payment summary when paymentConfigs is empty", () => {
    mockUseQuery.mockReturnValue([]);

    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.queryByText(/payment.*included/i)).not.toBeInTheDocument();
  });

  test("does not show payment summary when paymentConfigs is undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.queryByText(/payment.*included/i)).not.toBeInTheDocument();
  });

  test("filters out signed recipients — only pending and viewed show in list", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        name: "Signed User",
        email: "signed@example.com",
        role: "signer",
        status: "signed",
      },
    ];

    render(<SendDocumentDialog {...buildProps({ recipients })} />);

    // Pending recipient should appear in the recipients list
    expect(screen.getByText("Pending User")).toBeInTheDocument();
    // Signed recipient should NOT appear
    expect(screen.queryByText("Signed User")).not.toBeInTheDocument();
  });

  test("filters out approved recipients from display", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        name: "Approved User",
        email: "approved@example.com",
        role: "approver",
        status: "approved",
      },
    ];

    render(<SendDocumentDialog {...buildProps({ recipients })} />);

    expect(screen.getByText("Pending User")).toBeInTheDocument();
    expect(screen.queryByText("Approved User")).not.toBeInTheDocument();
  });

  test("filters out declined recipients from display", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        name: "Declined User",
        email: "declined@example.com",
        role: "signer",
        status: "declined",
      },
    ];

    render(<SendDocumentDialog {...buildProps({ recipients })} />);

    expect(screen.getByText("Pending User")).toBeInTheDocument();
    expect(screen.queryByText("Declined User")).not.toBeInTheDocument();
  });

  test("includes viewed recipients in display (not yet completed)", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        name: "Viewed User",
        email: "viewed@example.com",
        role: "signer",
        status: "viewed",
      },
    ];

    render(<SendDocumentDialog {...buildProps({ recipients })} />);
    expect(screen.getByText("Viewed User")).toBeInTheDocument();
  });

  test("shows the document name in the description", () => {
    render(<SendDocumentDialog {...buildProps({ open: true })} />);
    expect(screen.getByText(/"Test Document"/)).toBeInTheDocument();
  });

  test("shows correct pending recipient count in description", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        email: "a@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        email: "b@example.com",
        role: "signer",
        status: "signed",
      },
    ];

    render(<SendDocumentDialog {...buildProps({ recipients })} />);
    // Only 1 pending recipient — description should say "1 recipient"
    expect(screen.getByText(/1 recipient/i)).toBeInTheDocument();
  });

  test("shows 'No expiration' default in expiration dropdown", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByText("No expiration")).toBeInTheDocument();
  });

  test("shows Cancel button in footer", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  test("Cancel button is not disabled by default", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
  });
});
