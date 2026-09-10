import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type Id, parseId } from "@/lib/ids";

// Mock TanStack Query — must be hoisted before importing the component
const mockUseMutation = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mockUseMutation }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SendDocumentDialog } from "./send-document-dialog";

const FAKE_FIELD_ID_1 = parseId("signature_fields", "field_1");
const FAKE_FIELD_ID_2 = parseId("signature_fields", "field_2");
const FAKE_RECIPIENT_ID = parseId("document_recipients", "fake_recip");
const FAKE_RECIPIENT_ID_2 = parseId("document_recipients", "fake_recip_2");

interface BuildPropsOptions {
  open?: boolean;
  signatureFieldCount?: number;
  recipients?: Array<{
    _id: Id<"document_recipients">;
    publicId: string;
    name?: string;
    email: string;
    role: "signer" | "viewer" | "approver";
    status: "pending" | "viewed" | "signed" | "approved" | "declined";
  }>;
  fieldCountsByRecipient?: Map<string, number>;
  paymentConfigs?: Array<{
    fieldId: Id<"signature_fields">;
    totalAmountCents: number;
    currency: string;
    paymentType: string;
  }>;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

function buildProps(overrides: BuildPropsOptions = {}) {
  return {
    documentPublicId: "fake_doc",
    documentName: "Test Document",
    recipients: [
      {
        _id: FAKE_RECIPIENT_ID,
        publicId: "fake_recip",
        name: "Alice Smith",
        email: "alice@example.com",
        role: "signer" as const,
        status: "pending" as const,
      },
    ],
    signatureFieldCount: 2,
    paymentConfigs: [] as Array<{
      fieldId: Id<"signature_fields">;
      totalAmountCents: number;
      currency: string;
      paymentType: string;
    }>,
    open: true,
    onOpenChange: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
}

describe("SendDocumentDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockUseMutation.mockReset();
  });

  test("does not render dialog content when open is false", () => {
    render(<SendDocumentDialog {...buildProps({ open: false })} />);
    expect(screen.queryByText("Send Document")).not.toBeInTheDocument();
  });

  test("renders dialog title 'Send Document' when open is true", () => {
    render(<SendDocumentDialog {...buildProps({ open: true })} />);
    // The title is an <h2> with data-slot="dialog-title"; use heading role to distinguish
    // it from the "Send Document" button text also present in the DOM.
    expect(
      screen.getByRole("heading", { name: "Send Document" })
    ).toBeInTheDocument();
  });

  test("shows error when signatureFieldCount is 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 0 })} />);
    expect(
      screen.getByText("Cannot send document without signature fields.")
    ).toBeInTheDocument();
  });

  test("does not show signature field error when signatureFieldCount > 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 1 })} />);
    expect(
      screen.queryByText("Cannot send document without signature fields.")
    ).not.toBeInTheDocument();
  });

  test("Send button text shows 'Send Document'", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(
      screen.getByRole("button", { name: /Send Document/i })
    ).toBeInTheDocument();
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
      screen.getByText(
        /Recipients will receive an email with a link to sign the document/i
      )
    ).toBeInTheDocument();
  });

  test("does not show email info box when signatureFieldCount is 0", () => {
    render(<SendDocumentDialog {...buildProps({ signatureFieldCount: 0 })} />);
    expect(
      screen.queryByText(
        /Recipients will receive an email with a link to sign the document/i
      )
    ).not.toBeInTheDocument();
  });

  test("shows payment summary when paymentConfigs has items", () => {
    render(
      <SendDocumentDialog
        {...buildProps({
          paymentConfigs: [
            {
              fieldId: FAKE_FIELD_ID_1,
              currency: "usd",
              totalAmountCents: 5000,
              paymentType: "one-time",
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Payment will be included")).toBeInTheDocument();
  });

  test("shows correct singular payment text for a single payment config", () => {
    render(
      <SendDocumentDialog
        {...buildProps({
          paymentConfigs: [
            {
              fieldId: FAKE_FIELD_ID_1,
              currency: "usd",
              totalAmountCents: 10000,
              paymentType: "one-time",
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Payment will be included")).toBeInTheDocument();
    // $100.00 USD formatted
    expect(screen.getByText("$100.00 USD")).toBeInTheDocument();
  });

  test("shows correct plural payment text for multiple payment configs", () => {
    render(
      <SendDocumentDialog
        {...buildProps({
          paymentConfigs: [
            {
              fieldId: FAKE_FIELD_ID_1,
              currency: "usd",
              totalAmountCents: 5000,
              paymentType: "one-time",
            },
            {
              fieldId: FAKE_FIELD_ID_2,
              currency: "usd",
              totalAmountCents: 2500,
              paymentType: "one-time",
            },
          ],
        })}
      />
    );
    expect(screen.getByText("2 payments will be included")).toBeInTheDocument();
  });

  test("does not show payment summary when paymentConfigs is empty", () => {
    render(<SendDocumentDialog {...buildProps()} />);
    expect(screen.queryByText(/payment.*included/i)).not.toBeInTheDocument();
  });

  test("filters out signed recipients — only pending and viewed show in list", () => {
    const recipients: BuildPropsOptions["recipients"] = [
      {
        _id: FAKE_RECIPIENT_ID,
        publicId: "fake_recip",
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        publicId: "fake_recip_2",
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
        publicId: "fake_recip",
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        publicId: "fake_recip_2",
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
        publicId: "fake_recip",
        name: "Pending User",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        publicId: "fake_recip_2",
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
        publicId: "fake_recip",
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
        publicId: "fake_recip",
        email: "a@example.com",
        role: "signer",
        status: "pending",
      },
      {
        _id: FAKE_RECIPIENT_ID_2,
        publicId: "fake_recip_2",
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
