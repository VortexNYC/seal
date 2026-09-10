import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type ApiContact } from "@/lib/api-client";

import { parseId } from "../../lib/ids";
import { ExportContacts } from "./export-contacts";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function makeContact(overrides: Partial<ApiContact> = {}): ApiContact {
  return {
    _id: parseId("contacts", "contact_1"),
    _creationTime: 1700000000000,
    organizationId: parseId("organizations", "org_1"),
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    email: "john@example.com",
    status: "active",
    createdBy: parseId("users", "user_1"),
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  } as ApiContact;
}

describe("ExportContacts", () => {
  afterEach(cleanup);

  test("renders Export CSV button", () => {
    render(<ExportContacts contacts={[makeContact()]} />);
    expect(screen.getByText("Export CSV")).toBeDefined();
  });

  test("button is disabled when contacts array is empty", () => {
    render(<ExportContacts contacts={[]} />);
    const button = screen.getByRole("button", { name: /export csv/i });
    expect(button).toHaveAttribute("disabled");
  });

  test("button is enabled when contacts exist", () => {
    render(<ExportContacts contacts={[makeContact()]} />);
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
      revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    test("triggers file download when clicked", async () => {
      const user = userEvent.setup();
      render(<ExportContacts contacts={[makeContact()]} />);

      await user.click(screen.getByRole("button", { name: /export csv/i }));

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    test("creates CSV with correct headers and data", async () => {
      const user = userEvent.setup();
      const contact = makeContact({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "+1-555-1234",
        company: "Acme Inc.",
        title: "CEO",
        status: "lead",
        notes: "VIP client",
      });

      render(<ExportContacts contacts={[contact]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await sealAssertPresent(capturedBlob).text();

      expect(csvText).toContain(
        "First Name,Last Name,Email,Phone,Company,Title,Status,Notes,Created"
      );
      expect(csvText).toContain("Jane");
      expect(csvText).toContain("Smith");
      expect(csvText).toContain("jane@example.com");
      expect(csvText).toContain("+1-555-1234");
      expect(csvText).toContain("Acme Inc.");
      expect(csvText).toContain("CEO");
      expect(csvText).toContain("lead");
      expect(csvText).toContain("VIP client");
    });

    test("escapes fields containing commas", async () => {
      const user = userEvent.setup();
      const contact = makeContact({
        company: "Smith, Jones & Associates",
      });

      render(<ExportContacts contacts={[contact]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await sealAssertPresent(capturedBlob).text();
      expect(csvText).toContain('"Smith, Jones & Associates"');
    });

    test("escapes fields containing double quotes", async () => {
      const user = userEvent.setup();
      const contact = makeContact({
        notes: 'Said "hello world"',
      });

      render(<ExportContacts contacts={[contact]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await sealAssertPresent(capturedBlob).text();
      expect(csvText).toContain('"Said ""hello world"""');
    });

    test("handles optional fields as empty strings", async () => {
      const user = userEvent.setup();
      const contact = makeContact(); // no phone, company, title, notes

      render(<ExportContacts contacts={[contact]} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await sealAssertPresent(capturedBlob).text();
      const dataRow = csvText.split("\n")[1];

      // Should have empty fields for phone, company, title, notes
      expect(dataRow).toContain("John,Doe,john@example.com,,,,active,");
    });

    test("exports multiple contacts as separate rows", async () => {
      const user = userEvent.setup();
      const contacts = [
        makeContact({ firstName: "Alice", email: "alice@test.com" }),
        makeContact({
          _id: parseId("contacts", "contact_2"),
          firstName: "Bob",
          email: "bob@test.com",
        }),
      ];

      render(<ExportContacts contacts={contacts} />);
      await user.click(screen.getByRole("button", { name: /export csv/i }));

      const csvText = await sealAssertPresent(capturedBlob).text();
      const lines = csvText.split("\n");

      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[1]).toContain("Alice");
      expect(lines[2]).toContain("Bob");
    });
  });
});
