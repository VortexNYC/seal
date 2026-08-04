import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: () => ({}),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("react-signature-canvas", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

import { SignatureCapture } from "./signature-capture";

interface RenderOptions {
  recipientName?: string;
  onSignatureCapture?: (
    signature: string,
    type: "drawn" | "typed" | "uploaded"
  ) => void;
  onCancel?: () => void;
  showLibrary?: boolean;
}

function renderSignatureCapture(overrides: RenderOptions = {}) {
  const props = {
    onSignatureCapture: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<SignatureCapture {...props} />);
  return props;
}

describe("SignatureCapture", () => {
  afterEach(cleanup);

  test('renders "Sign Document" title', () => {
    renderSignatureCapture();
    expect(screen.getByText("Sign Document")).toBeInTheDocument();
  });

  test('renders "Choose your preferred method..." description', () => {
    renderSignatureCapture();
    expect(
      screen.getByText("Choose your preferred method to sign this document")
    ).toBeInTheDocument();
  });

  test("shows 3 tabs (Draw, Type, Upload) when showLibrary is false", () => {
    renderSignatureCapture({ showLibrary: false });
    expect(screen.getByText("Draw")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  test("shows 4 tabs (Saved, Draw, Type, Upload) when showLibrary is true", () => {
    renderSignatureCapture({ showLibrary: true });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Draw")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
  });

  test('shows "Cancel" and "Accept & Sign" buttons', () => {
    renderSignatureCapture();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Accept & Sign/i })
    ).toBeInTheDocument();
  });

  test("shows legal text about signature agreement", () => {
    renderSignatureCapture();
    expect(
      screen.getByText(
        /By clicking "Accept & Sign", you agree that this is a legal representation of your signature\./i
      )
    ).toBeInTheDocument();
  });

  test("type tab renders name input with recipientName as default value", async () => {
    const user = userEvent.setup();
    renderSignatureCapture({ recipientName: "Jane Smith" });
    await user.click(screen.getByRole("tab", { name: /Type/i }));
    const input = screen.getByRole("textbox", {
      name: /type your full name/i,
    }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Jane Smith");
  });

  test('upload tab shows file upload info text "Upload a PNG or JPG image file (max 5MB)"', async () => {
    const user = userEvent.setup();
    renderSignatureCapture();
    await user.click(screen.getByRole("tab", { name: /Upload/i }));
    expect(
      screen.getByText("Upload a PNG or JPG image file (max 5MB)")
    ).toBeInTheDocument();
  });
});
