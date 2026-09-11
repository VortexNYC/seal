import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ApiContact } from "@/lib/api-client";

const mockUpdateContact = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  updateContact: mockUpdateContact,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { EditContactDialog } from "./edit-contact-dialog";

function makeContact(overrides: Partial<ApiContact> = {}): ApiContact {
  return {
    _id: "contact_1",
    firstName: "Jane",
    lastName: "Smith",
    fullName: "Jane Smith",
    email: "jane@example.com",
    phone: "+1-555-9876",
    company: "Acme Corp",
    title: "CTO",
    status: "active",
    notes: "Important client",
    tags: [],
    createdBy: "user_1",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function getFieldByLabel<ElementType extends HTMLElement>(
  label: RegExp,
  elementType: abstract new () => ElementType
): ElementType {
  const element = screen.getByLabelText(label);
  if (!(element instanceof elementType)) {
    throw new Error(`Expected ${elementType.name} for label ${String(label)}`);
  }
  return element;
}

function renderDialog(
  overrides: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onUpdated?: (contact: ApiContact) => void;
    contact?: ApiContact;
  } = {}
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onUpdated: vi.fn(),
    contact: makeContact(),
    organizationSlug: "acme",
    ...overrides,
  };
  return { ...render(<EditContactDialog {...props} />), props };
}

describe("EditContactDialog", () => {
  afterEach(() => {
    cleanup();
    mockUpdateContact.mockReset();
  });

  describe("rendering and pre-population", () => {
    test("renders dialog title", () => {
      renderDialog();
      expect(screen.getByText("Edit Contact")).toBeDefined();
    });

    test("pre-populates first name from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/first name/i, HTMLInputElement);
      expect(input.value).toBe("Jane");
    });

    test("pre-populates last name from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/last name/i, HTMLInputElement);
      expect(input.value).toBe("Smith");
    });

    test("pre-populates email from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/email/i, HTMLInputElement);
      expect(input.value).toBe("jane@example.com");
    });

    test("pre-populates phone from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/phone/i, HTMLInputElement);
      expect(input.value).toBe("+1-555-9876");
    });

    test("pre-populates company from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/company/i, HTMLInputElement);
      expect(input.value).toBe("Acme Corp");
    });

    test("pre-populates title from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/^title$/i, HTMLInputElement);
      expect(input.value).toBe("CTO");
    });

    test("pre-populates notes from contact prop", () => {
      renderDialog();
      const input = getFieldByLabel(/notes/i, HTMLTextAreaElement);
      expect(input.value).toBe("Important client");
    });

    test("shows empty string for missing optional fields", () => {
      renderDialog({
        contact: makeContact({ phone: undefined, company: undefined }),
      });
      expect(getFieldByLabel(/phone/i, HTMLInputElement).value).toBe("");
      expect(getFieldByLabel(/company/i, HTMLInputElement).value).toBe("");
    });

    test("renders Save Changes button", () => {
      renderDialog();
      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeDefined();
    });
  });

  describe("validation", () => {
    test("shows error when first name is cleared and submitted", async () => {
      const user = userEvent.setup();
      renderDialog();

      const firstNameInput = getFieldByLabel(/first name/i, HTMLInputElement);
      await user.clear(firstNameInput);
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(screen.getByText("First name is required")).toBeDefined();
      expect(mockUpdateContact).not.toHaveBeenCalled();
    });

    test("shows error when email is cleared", async () => {
      const user = userEvent.setup();
      renderDialog();

      const emailInput = getFieldByLabel(/email/i, HTMLInputElement);
      await user.clear(emailInput);
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(screen.getByText("Email is required")).toBeDefined();
      expect(mockUpdateContact).not.toHaveBeenCalled();
    });
  });

  describe("form submission", () => {
    test("calls updateContact with correct data", async () => {
      const user = userEvent.setup();
      const contact = makeContact();
      mockUpdateContact.mockResolvedValue(contact);

      renderDialog();

      const firstNameInput = getFieldByLabel(/first name/i, HTMLInputElement);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Janet");
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(mockUpdateContact).toHaveBeenCalledWith(
        "acme",
        "contact_1",
        expect.objectContaining({
          firstName: "Janet",
        })
      );
    });

    test("calls onOpenChange(false) after successful update", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const contact = makeContact();
      mockUpdateContact.mockResolvedValue(contact);

      renderDialog({ onOpenChange });

      const firstNameInput = getFieldByLabel(/first name/i, HTMLInputElement);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Janet");
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    test("shows success toast on update", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      const contact = makeContact();
      mockUpdateContact.mockResolvedValue(contact);

      renderDialog();

      const firstNameInput = getFieldByLabel(/first name/i, HTMLInputElement);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Janet");
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(toast.success).toHaveBeenCalledWith("Contact updated");
    });

    test("shows error toast when mutation fails", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockUpdateContact.mockRejectedValue(new Error("Network error"));

      renderDialog();

      const firstNameInput = getFieldByLabel(/first name/i, HTMLInputElement);
      await user.clear(firstNameInput);
      await user.type(firstNameInput, "Janet");
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });

  describe("cancel behavior", () => {
    test("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      renderDialog({ onOpenChange });

      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
