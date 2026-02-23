import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const mockMutateAsync = vi.fn();

vi.mock("@convex-dev/react-query", () => ({
  useConvexMutation: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

import { AttachmentFieldInput } from "./attachment-field-input";

afterEach(cleanup);

function renderAttachmentField(
  overrides: Partial<Parameters<typeof AttachmentFieldInput>[0]> = {},
) {
  const onChange = vi.fn();
  const onValidationChange = vi.fn();

  const result = render(
    <AttachmentFieldInput
      label="Attachment"
      isRequired={false}
      onChange={onChange}
      onValidationChange={onValidationChange}
      {...overrides}
    />,
  );

  return { onChange, onValidationChange, ...result };
}

describe("AttachmentFieldInput", () => {
  test("renders label", () => {
    renderAttachmentField({ label: "Proof of Identity" });
    expect(screen.getByText("Proof of Identity")).toBeInTheDocument();
  });

  test("shows required indicator when isRequired is true", () => {
    renderAttachmentField({ isRequired: true });
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  test("shows upload area with 'Click to upload' text when no value provided", () => {
    renderAttachmentField();
    expect(screen.getByText("Click to upload")).toBeInTheDocument();
  });

  test("shows maximum file size text in upload area", () => {
    renderAttachmentField();
    expect(screen.getByText("Maximum file size: 10MB")).toBeInTheDocument();
  });

  test("shows file info with 'File attached' text when value is provided", () => {
    renderAttachmentField({ value: "storage-id-abc123" });
    expect(screen.getByText("File attached")).toBeInTheDocument();
  });

  test("shows help text when no error", () => {
    renderAttachmentField({ helpText: "Upload a PDF or image" });
    expect(screen.getByText("Upload a PDF or image")).toBeInTheDocument();
  });

  test("hides help text when error exists", () => {
    // Render with a value so we can trigger remove to cause a required error
    renderAttachmentField({
      helpText: "Upload a PDF or image",
      isRequired: true,
      value: "storage-id-abc123",
    });

    // Click the remove button to clear the value and trigger the required error
    const removeButton = screen.getByRole("button");
    fireEvent.click(removeButton);

    expect(screen.queryByText("Upload a PDF or image")).not.toBeInTheDocument();
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });
});
