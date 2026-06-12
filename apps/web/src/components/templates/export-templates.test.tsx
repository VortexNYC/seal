import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ExportTemplates } from "./export-templates";

function makeTemplate(overrides: Partial<Doc<"templates">> = {}): Doc<"templates"> {
  return {
    _id: "template_1" as Id<"templates">,
    _creationTime: 1700000000000,
    organizationId: "org_1" as Id<"organizations">,
    createdBy: "user_1" as Id<"users">,
    name: "NDA Template",
    status: "active",
    storageId: "storage_1",
    fileSize: 245760,
    fileType: "application/pdf",
    useCount: 42,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  } as Doc<"templates">;
}

describe("ExportTemplates", () => {
  afterEach(cleanup);

  test("renders Export CSV button", () => {
    render(<ExportTemplates templates={[makeTemplate()]} />);
    expect(screen.getByText("Export CSV")).toBeDefined();
  });

  test("button is disabled when templates array is empty", () => {
    render(<ExportTemplates templates={[]} />);
    const button = screen.getByRole("button", { name: /export csv/i });
    expect(button).toHaveAttribute("disabled");
  });

  test("button is enabled when templates exist", () => {
    render(<ExportTemplates templates={[makeTemplate()]} />);
    const button = screen.getByRole("button", { name: /export csv/i });
    expect(button).not.toHaveAttribute("disabled");
  });

  describe("CSV generation", () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let capturedBlob: Blob | undefined;

    beforeEach(() => {
      capturedBlob = undefined;
      createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockImplementation((blob: Blob | MediaSource) => {
          capturedBlob = blob instanceof Blob ? blob : undefined;
          return "blob:test";
        });
      revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    test("triggers file download when clicked", async () => {
      const user = userEvent.setup();
      render(<ExportTemplates templates={[makeTemplate()]} />);

      await user.click(screen.getByRole("button", { name: /export csv/i }));

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    test("creates CSV with correct headers and data", async () => {
      const user = userEvent.setup();
      const template = makeTemplate({
        name: "Service Agreement",
        description: "Standard service agreement template",
        status: "active",
        pageCount: 3,
        fileSize: 524288,
        fileType: "application/pdf",
        useCount: 15,
      });

      render(<ExportTemplates templates={[template]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await capturedBlob!.text();

      expect(csvText).toContain(
        "Name,Description,Status,Pages,File Size,File Type,Times Used,Created",
      );
      expect(csvText).toContain("Service Agreement");
      expect(csvText).toContain("Standard service agreement template");
      expect(csvText).toContain("active");
      expect(csvText).toContain("3");
      expect(csvText).toContain("512 KB");
      expect(csvText).toContain("application/pdf");
      expect(csvText).toContain("15");
    });

    test("escapes fields containing commas", async () => {
      const user = userEvent.setup();
      const template = makeTemplate({
        description: "Template for invoices, receipts, and billing documents",
      });

      render(<ExportTemplates templates={[template]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await capturedBlob!.text();
      expect(csvText).toContain('"Template for invoices, receipts, and billing documents"');
    });

    test("escapes fields containing double quotes", async () => {
      const user = userEvent.setup();
      const template = makeTemplate({
        description: 'For "premium" clients only',
      });

      render(<ExportTemplates templates={[template]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await capturedBlob!.text();
      expect(csvText).toContain('"For ""premium"" clients only"');
    });

    test("handles optional fields as empty strings", async () => {
      const user = userEvent.setup();
      const template = makeTemplate();

      render(<ExportTemplates templates={[template]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await capturedBlob!.text();
      const dataRow = csvText.split("\n")[1];

      expect(dataRow).toContain("NDA Template,,active,,240 KB,application/pdf,42,");
    });

    test("exports multiple templates as separate rows", async () => {
      const user = userEvent.setup();
      const templates = [
        makeTemplate({ name: "Alpha", useCount: 10 }),
        makeTemplate({
          _id: "template_2" as Id<"templates">,
          name: "Beta",
          useCount: 20,
        }),
      ];

      render(<ExportTemplates templates={templates} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await capturedBlob!.text();
      const lines = csvText.split("\n");

      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain("Alpha");
      expect(lines[2]).toContain("Beta");
    });
  });
});
