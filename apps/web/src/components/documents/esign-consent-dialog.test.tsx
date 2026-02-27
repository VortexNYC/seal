import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/components/seal-logo", () => ({
  SealLogo: () => <div data-testid="seal-logo" />,
}));

import { EsignConsentDialog } from "./esign-consent-dialog";

interface RenderOptions {
  recipientEmail?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onDownloadPdf?: () => void;
  onOptOut?: (method: string) => void;
  isSubmitting?: boolean;
}

function renderConsent(overrides: RenderOptions = {}) {
  const props = {
    recipientEmail: "test@example.com",
    onAccept: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  };
  render(<EsignConsentDialog {...props} />);
  return props;
}

describe("EsignConsentDialog", () => {
  afterEach(cleanup);

  test("renders consent form in pending state with heading", () => {
    renderConsent();
    expect(screen.getByText("Electronic Signature Consent")).toBeDefined();
  });

  test('"Continue to Document" button is disabled initially when checkbox is not checked', () => {
    renderConsent();
    const button = screen.getByRole("button", { name: "Continue to Document" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  test('shows "Recording consent..." and disables button when isSubmitting is true', () => {
    renderConsent({ isSubmitting: true });
    const button = screen.getByRole("button", { name: "Recording consent..." });
    expect(button).toBeDefined();
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  test('clicking "Decline & Exit" shows declined state with correct heading', async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline & Exit" }));
    expect(screen.getByText("Electronic Signature Declined")).toBeDefined();
  });

  test("declined state shows download button when onDownloadPdf is provided", async () => {
    const user = userEvent.setup();
    renderConsent({ onDownloadPdf: vi.fn() });
    await user.click(screen.getByRole("button", { name: "Decline & Exit" }));
    expect(screen.getByRole("button", { name: /Download PDF for Manual Signing/i })).toBeDefined();
  });

  test("declined state hides download button when onDownloadPdf is not provided", async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline & Exit" }));
    expect(screen.queryByRole("button", { name: /Download PDF for Manual Signing/i })).toBeNull();
  });

  test('"Back to Consent" returns to pending state', async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline & Exit" }));
    expect(screen.getByText("Electronic Signature Declined")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Back to Consent" }));
    expect(screen.getByText("Electronic Signature Consent")).toBeDefined();
  });

  test("shows recipientEmail in accepted state after checking consent and clicking continue", async () => {
    const user = userEvent.setup();
    const email = "signer@example.com";
    renderConsent({ recipientEmail: email });

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: "Continue to Document" }));

    expect(screen.getByText(email)).toBeDefined();
    expect(screen.getByText("Consent Accepted")).toBeDefined();
  });
});
