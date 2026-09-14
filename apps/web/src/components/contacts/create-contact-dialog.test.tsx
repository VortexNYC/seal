import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ApiContact } from "@/lib/api-client";

const mockCreateContact = vi.hoisted(() => vi.fn());
const mockGetContactByEmail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  createContact: mockCreateContact,
  getContactByEmail: mockGetContactByEmail,
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { CreateContactDialog } from "./create-contact-dialog";

function makeApiContact(overrides: Partial<ApiContact> = {}): ApiContact {
  return {
    _id: "contact_1",
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    email: "john@test.com",
    status: "active",
    tags: [],
    createdBy: "user_1",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

function renderDialog(
  overrides: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onCreated?: (contact: ApiContact) => void;
  } = {}
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    onCreated: vi.fn(),
    organizationSlug: "acme",
    ...overrides,
  };
  return { ...render(<CreateContactDialog {...props} />), props };
}

describe("CreateContactDialog", () => {
  afterEach(() => {
    cleanup();
    mockCreateContact.mockReset();
    mockGetContactByEmail.mockReset();
  });

  describe("rendering", () => {
    test("renders dialog title", () => {
      renderDialog();
      expect(screen.getByText("Add Contact")).toBeDefined();
    });

    test("renders description text", () => {
      renderDialog();
      expect(
        screen.getByText("Create a new contact for your organization.")
      ).toBeDefined();
    });

    test("renders required field labels with asterisk", () => {
      renderDialog();
      expect(screen.getByLabelText(/first name/i)).toBeDefined();
      expect(screen.getByLabelText(/last name/i)).toBeDefined();
      expect(screen.getByLabelText(/email/i)).toBeDefined();
    });

    test("renders optional fields", () => {
      renderDialog();
      expect(screen.getByLabelText(/phone/i)).toBeDefined();
      expect(screen.getByLabelText(/company/i)).toBeDefined();
      expect(screen.getByLabelText(/^title$/i)).toBeDefined();
      expect(screen.getByLabelText(/notes/i)).toBeDefined();
    });

    test("renders Cancel and Create Contact buttons", () => {
      renderDialog();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
      expect(
        screen.getByRole("button", { name: /create contact/i })
      ).toBeDefined();
    });

    test("renders status select trigger", () => {
      renderDialog();
      const statusTrigger = screen.getByRole("combobox", { name: /status/i });
      expect(statusTrigger).toBeDefined();
    });
  });

  describe("validation", () => {
    test("shows error when first name is empty on submit", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(screen.getByText("First name is required")).toBeDefined();
      expect(mockCreateContact).not.toHaveBeenCalled();
    });

    test("shows error when last name is empty on submit", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(screen.getByText("Last name is required")).toBeDefined();
      expect(mockCreateContact).not.toHaveBeenCalled();
    });

    test("shows error when email is empty on submit", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeDefined();
      expect(mockCreateContact).not.toHaveBeenCalled();
    });

    test("shows email required error when email is empty", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeDefined();
      expect(mockCreateContact).not.toHaveBeenCalled();
    });

    test("clears field error when user starts typing", async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.click(screen.getByRole("button", { name: /create contact/i }));
      expect(screen.getByText("First name is required")).toBeDefined();

      await user.type(screen.getByLabelText(/first name/i), "J");
      expect(screen.queryByText("First name is required")).toBeNull();
    });
  });

  describe("form submission", () => {
    test("calls createContact with correct data", async () => {
      const user = userEvent.setup();
      mockCreateContact.mockResolvedValue(makeApiContact());

      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.type(screen.getByLabelText(/phone/i), "+1-555-1234");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(mockCreateContact).toHaveBeenCalledWith(
        "acme",
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          email: "john@test.com",
          phone: "+1-555-1234",
          status: "active",
        })
      );
    });

    test("calls onOpenChange(false) after successful submission", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      mockCreateContact.mockResolvedValue(makeApiContact());

      renderDialog({ onOpenChange });

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    test("shows success toast on successful creation", async () => {
      const user = userEvent.setup();
      const { toast } = await import("@/lib/toast");
      mockCreateContact.mockResolvedValue(makeApiContact());

      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(toast.success).toHaveBeenCalledWith("Contact created");
    });

    test("shows warning toast when duplicate is created", async () => {
      const user = userEvent.setup();
      const { toast } = await import("@/lib/toast");
      mockGetContactByEmail.mockResolvedValue(makeApiContact());
      mockCreateContact.mockResolvedValue(makeApiContact());

      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.tab();

      await waitFor(() =>
        expect(
          screen.getByText("A contact with this email already exists.")
        ).toBeDefined()
      );

      await user.click(screen.getByRole("button", { name: /create contact/i }));

      expect(toast.warning).toHaveBeenCalledWith(
        "A contact with this email already exists. A duplicate was created."
      );
    });

    test("shows error toast when creation fails", async () => {
      const user = userEvent.setup();
      const { toast } = await import("@/lib/toast");
      mockCreateContact.mockRejectedValue(new Error("Network error"));

      renderDialog();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/email/i), "john@test.com");
      await user.click(screen.getByRole("button", { name: /create contact/i }));

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
