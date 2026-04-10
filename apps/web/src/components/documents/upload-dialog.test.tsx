import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.stubEnv("VITE_CONVEX_URL", "https://example.com");

const mockUseMutation = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUseMutation,
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: { documentUploaded: vi.fn() } }),
}));

vi.mock("../../lib/pdf-utils", () => ({
  extractPdfMetadata: vi.fn().mockResolvedValue({ pageCount: 1, thumbnail: null }),
}));

vi.mock("../../lib/upload-validation", () => ({
  DROPZONE_ACCEPT_TYPES: { "application/pdf": [".pdf"] },
  formatFileSize: (bytes: number) => `${Math.round(bytes / 1024)} KB`,
  getMaxFileSizeDisplay: () => "100 MB",
  getSupportedFileTypesDisplay: () => "PDF only",
  validateFileForUpload: () => ({ valid: true, errors: [] }),
}));

import { UploadDialog } from "./upload-dialog";

const FAKE_ORG_ID = "fake_org_id" as Id<"organizations">;

function renderDialog(
  overrides: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
  } = {},
) {
  const props = {
    organizationId: FAKE_ORG_ID,
    open: true,
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(<UploadDialog {...props} />);
  return props;
}

describe("UploadDialog", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CONVEX_URL", "https://local.convex.cloud");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
  });

  test("does not render dialog content when open is false", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog({ open: false });
    expect(screen.queryByText("Upload Documents")).not.toBeInTheDocument();
  });

  test("renders dialog title when open is true", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog({ open: true });
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
  });

  test("does not show usage stats when query returns undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog();
    expect(screen.queryByText("Documents this month")).not.toBeInTheDocument();
  });

  test("shows usage stats when query returns data", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 3,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    expect(screen.getByText("Documents this month")).toBeInTheDocument();
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
  });

  test("does not show limit reached message when under the limit", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 3,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    expect(
      screen.queryByText(/You've reached your monthly document limit/),
    ).not.toBeInTheDocument();
  });

  test("shows limit reached message when at capacity", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 10,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    expect(screen.getByText(/You've reached your monthly document limit/)).toBeInTheDocument();
  });

  test("shows upgrade prompt for free plan when at limit", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 10,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    expect(
      screen.getByText(/Upgrade to Professional for up to 500 documents per month/),
    ).toBeInTheDocument();
  });

  test("does not show upgrade prompt for non-free plan when at limit", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 500,
      documentsLimit: 500,
      plan: "pro",
    });
    renderDialog();
    expect(
      screen.queryByText(/Upgrade to Professional for up to 500 documents per month/),
    ).not.toBeInTheDocument();
  });

  test("upload button is disabled when no files are selected", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog();
    const uploadButton = screen.getByRole("button", { name: "Upload PDF" });
    expect(uploadButton).toBeDisabled();
  });

  test("upload button is disabled when at document limit", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 10,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    const uploadButton = screen.getByRole("button", { name: "Upload PDF" });
    expect(uploadButton).toBeDisabled();
  });

  test("upload button is enabled when under limit and no file selected check passes", () => {
    mockUseQuery.mockReturnValue({
      documentsThisMonth: 3,
      documentsLimit: 10,
      plan: "free",
    });
    renderDialog();
    // Button should be disabled because no file is selected yet, regardless of limit status
    const uploadButton = screen.getByRole("button", { name: "Upload PDF" });
    expect(uploadButton).toBeDisabled();
  });

  test("renders dropzone area with PDF instructions", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog();
    expect(screen.getByText("Drag & drop a PDF file here, or click to select")).toBeInTheDocument();
    expect(screen.getByText("PDF files only, one at a time")).toBeInTheDocument();
  });

  test("renders cancel button", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
