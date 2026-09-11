import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { UploadDialog } from "./upload-dialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../hooks/use-analytics", () => ({
  useAnalytics: () => ({ track: { documentUploaded: vi.fn() } }),
}));

vi.mock("../../lib/pdf-utils", () => ({
  extractPdfMetadata: vi
    .fn()
    .mockResolvedValue({ pageCount: 1, thumbnail: null }),
}));

vi.mock("../../lib/upload-validation", () => ({
  DROPZONE_ACCEPT_TYPES: { "application/pdf": [".pdf"] },
  formatFileSize: (bytes: number) => `${Math.round(bytes / 1024)} KB`,
  getMaxFileSizeDisplay: () => "100 MB",
  getSupportedFileTypesDisplay: () => "PDF only",
  validateFileForUpload: () => ({ valid: true, errors: [] }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: { retry: false },
  },
});

function renderDialog(
  overrides: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
  } = {}
) {
  const props = {
    organizationId: "fake_org_id",
    organizationSlug: "acme",
    open: true,
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(
    <QueryClientProvider client={queryClient}>
      <UploadDialog {...props} />
    </QueryClientProvider>
  );
  return props;
}

describe("UploadDialog", () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
  });

  test("does not render dialog content when open is false", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Upload Documents")).not.toBeInTheDocument();
  });

  test("renders dialog title when open is true", () => {
    renderDialog({ open: true });
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
  });

  test("does not show usage stats", () => {
    renderDialog();
    expect(screen.queryByText("Documents this month")).not.toBeInTheDocument();
  });

  test("upload button is disabled when no files are selected", () => {
    renderDialog();
    const uploadButton = screen.getByRole("button", { name: "Upload PDF" });
    expect(uploadButton).toBeDisabled();
  });

  test("renders dropzone area with PDF instructions", () => {
    renderDialog();
    expect(
      screen.getByText("Drag & drop a PDF file here, or click to select")
    ).toBeInTheDocument();
    expect(
      screen.getByText("PDF files only, one at a time")
    ).toBeInTheDocument();
  });

  test("renders cancel button", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
