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

  test("accept button is disabled initially when checkbox is not checked", () => {
    renderConsent();
    const button = screen.getByRole("button", { name: "Accept electronic signature consent" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  test("accept button is disabled and shows submitting text when isSubmitting is true", () => {
    renderConsent({ isSubmitting: true });
    const button = screen.getByRole("button", { name: "Accept electronic signature consent" });
    expect(button).toBeDefined();
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toBe("Recording consent...");
  });

  test("clicking decline shows declined state with correct heading", async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline electronic signature consent" }));
    expect(screen.getByText("Electronic Signature Declined")).toBeDefined();
  });

  test("declined state shows download button when onDownloadPdf is provided", async () => {
    const user = userEvent.setup();
    renderConsent({ onDownloadPdf: vi.fn() });
    await user.click(screen.getByRole("button", { name: "Decline electronic signature consent" }));
    expect(screen.getByRole("button", { name: /Download PDF for Manual Signing/i })).toBeDefined();
  });

  test("declined state hides download button when onDownloadPdf is not provided", async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline electronic signature consent" }));
    expect(screen.queryByRole("button", { name: /Download PDF for Manual Signing/i })).toBeNull();
  });

  test("back to consent returns to pending state", async () => {
    const user = userEvent.setup();
    renderConsent();
    await user.click(screen.getByRole("button", { name: "Decline electronic signature consent" }));
    expect(screen.getByText("Electronic Signature Declined")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Return to consent terms" }));
    expect(screen.getByText("Electronic Signature Consent")).toBeDefined();
  });

  test("shows recipientEmail in accepted state after checking consent and clicking continue", async () => {
    const user = userEvent.setup();
    const email = "signer@example.com";
    renderConsent({ recipientEmail: email });

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await user.click(screen.getByRole("button", { name: "Accept electronic signature consent" }));

    expect(screen.getByText(email)).toBeDefined();
    expect(screen.getByText("Consent Accepted")).toBeDefined();
  });
});
