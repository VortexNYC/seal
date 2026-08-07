import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockUseMutation = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUseMutation,
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { parseId } from "../../lib/convex-ids";
import { AddRecipientDialog } from "./add-recipient-dialog";

const FAKE_DOC_ID = parseId("documents", "fake_doc");
const FAKE_ORG_ID = parseId("organizations", "fake_org");

type Member = {
  id: string;
  email: string;
  name: string | undefined;
  avatarUrl: string | null;
  status: string;
};

function makeMembers(overrides: Partial<Member>[] = []): Member[] {
  return overrides.map((o, i) => ({
    id: `member_${i}`,
    email: `member${i}@example.com`,
    name: `Member ${i}`,
    avatarUrl: null,
    status: "active",
    ...o,
  }));
}

interface RenderOptions {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  existingRecipientEmails?: string[];
  currentUserEmail?: string;
}

function renderDialog(overrides: RenderOptions = {}) {
  const props = {
    documentId: FAKE_DOC_ID,
    organizationId: FAKE_ORG_ID,
    open: true,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    onSuccess: vi.fn<() => void>(),
    existingRecipientEmails: [] as string[],
    currentUserEmail: undefined as string | undefined,
    ...overrides,
  };
  render(<AddRecipientDialog {...props} />);
  return props;
}

describe("AddRecipientDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockUseMutation.mockReset();
    mockUseQuery.mockReset();
  });

  describe("open / closed visibility", () => {
    test("does not render dialog content when open is false", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog({ open: false });
      expect(screen.queryByText("Add Recipient")).not.toBeInTheDocument();
    });

    test("renders 'Add Recipient' title when open is true", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog({ open: true });
      // Use role=heading to distinguish the dialog title from the submit button text
      expect(
        screen.getByRole("heading", { name: "Add Recipient" })
      ).toBeInTheDocument();
    });

    test("renders description when open", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog();
      expect(
        screen.getByText(
          "Add a person who needs to take action on this document."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Team tab — loading state", () => {
    test("shows a loading spinner when members query returns undefined", () => {
      mockUseQuery.mockReturnValue(undefined);
      renderDialog();
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeTruthy();
    });

    test("does not show the member list while loading", () => {
      mockUseQuery.mockReturnValue(undefined);
      renderDialog();
      expect(
        screen.queryByRole("button", { name: /member/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Team tab — empty state", () => {
    test("shows 'No team members available' when member list is empty and no existing recipients", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog({ existingRecipientEmails: [] });
      expect(screen.getByText("No team members available")).toBeInTheDocument();
    });

    test("shows 'All team members have been added' when members are non-empty but all filtered out", () => {
      const members = makeMembers([{ email: "alice@example.com" }]);
      mockUseQuery.mockReturnValue(members);
      renderDialog({ existingRecipientEmails: ["alice@example.com"] });
      expect(
        screen.getByText("All team members have been added")
      ).toBeInTheDocument();
    });

    test("filters out current user from team list", () => {
      const members = makeMembers([
        { email: "self@example.com", name: "Self" },
        { email: "other@example.com", name: "Other" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog({ currentUserEmail: "self@example.com" });
      expect(screen.queryByText("Self")).not.toBeInTheDocument();
      expect(screen.getByText("Other")).toBeInTheDocument();
    });

    test("filters out existing recipients from team list", () => {
      const members = makeMembers([
        { email: "added@example.com", name: "Already Added" },
        { email: "new@example.com", name: "New Person" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog({ existingRecipientEmails: ["added@example.com"] });
      expect(screen.queryByText("Already Added")).not.toBeInTheDocument();
      expect(screen.getByText("New Person")).toBeInTheDocument();
    });

    test("filters out inactive members", () => {
      const members = makeMembers([
        {
          email: "inactive@example.com",
          name: "Inactive User",
          status: "inactive",
        },
        { email: "active@example.com", name: "Active User", status: "active" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.queryByText("Inactive User")).not.toBeInTheDocument();
      expect(screen.getByText("Active User")).toBeInTheDocument();
    });

    test("shows 'All team members have been added' when all remaining members are filtered out by existing recipients", () => {
      const members = makeMembers([
        { email: "self@example.com", name: "Self", status: "active" },
        { email: "added@example.com", name: "Already Added", status: "active" },
        { email: "inactive@example.com", name: "Inactive", status: "inactive" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog({
        currentUserEmail: "self@example.com",
        existingRecipientEmails: ["added@example.com"],
      });
      // "self" filtered by currentUserEmail, "added" filtered by existingRecipientEmails,
      // "inactive" filtered by status. existingRecipientEmails.length > 0 so message is
      // "All team members have been added".
      expect(
        screen.getByText("All team members have been added")
      ).toBeInTheDocument();
    });
  });

  describe("Team tab — member list", () => {
    test("renders eligible member names and emails", () => {
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
        { email: "bob@example.com", name: "Bob Jones" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    test("shows member count in the Team tab trigger", () => {
      const members = makeMembers([
        { email: "a@example.com" },
        { email: "b@example.com" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("Team (2)")).toBeInTheDocument();
    });

    test("renders avatar initials for a member with two-word name", () => {
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("AS")).toBeInTheDocument();
    });

    test("renders avatar initials for a member with single-word name", () => {
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    test("renders '?' as avatar fallback when member name is null/undefined", () => {
      const members = makeMembers([
        { email: "anon@example.com", name: undefined },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    test("selecting a member enables the submit button", async () => {
      const user = userEvent.setup();
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();

      const addButton = screen.getByRole("button", { name: "Add Recipient" });
      expect(addButton).toBeDisabled();

      const memberRow = screen.getByRole("button", { name: /Alice Smith/i });
      await user.click(memberRow);

      expect(addButton).not.toBeDisabled();
    });

    test("shows check icon next to selected member", async () => {
      const user = userEvent.setup();
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();

      const memberRow = screen.getByRole("button", { name: /Alice Smith/i });
      await user.click(memberRow);

      // The check icon is rendered as an SVG alongside the member row; verify the member row
      // receives the selected highlight class
      expect(memberRow.className).toContain("bg-accent");
    });
  });

  describe("External tab", () => {
    async function switchToExternal() {
      const user = userEvent.setup();
      mockUseQuery.mockReturnValue([]);
      renderDialog();
      await user.click(screen.getByRole("tab", { name: "External" }));
      return user;
    }

    test("shows email and name inputs on the External tab", async () => {
      await switchToExternal();
      expect(screen.getByLabelText("Email Address *")).toBeInTheDocument();
      expect(screen.getByLabelText("Name (Optional)")).toBeInTheDocument();
    });

    test("submit is disabled when external email is empty", async () => {
      await switchToExternal();
      expect(
        screen.getByRole("button", { name: "Add Recipient" })
      ).toBeDisabled();
    });

    test("submit is disabled when external email has no '@'", async () => {
      const user = await switchToExternal();
      await user.type(screen.getByLabelText("Email Address *"), "invalidemail");
      expect(
        screen.getByRole("button", { name: "Add Recipient" })
      ).toBeDisabled();
    });

    test("submit becomes enabled once a valid email is entered", async () => {
      const user = await switchToExternal();
      await user.type(
        screen.getByLabelText("Email Address *"),
        "valid@example.com"
      );
      expect(
        screen.getByRole("button", { name: "Add Recipient" })
      ).not.toBeDisabled();
    });
  });

  describe("Role selector", () => {
    test("renders a role label and combobox trigger", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog();
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
      // The Radix Select renders as a combobox
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("shows role description for signer by default", () => {
      mockUseQuery.mockReturnValue([]);
      renderDialog();
      expect(
        screen.getByText("This person must sign the document.")
      ).toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    test("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      mockUseQuery.mockReturnValue([]);
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Form submission — team tab", () => {
    test("calls addRecipients mutation with selected member details on submit", async () => {
      const user = userEvent.setup();
      mockUseMutation.mockResolvedValue(undefined);
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      const onSuccess = vi.fn();
      renderDialog({ onSuccess });

      await user.click(screen.getByRole("button", { name: /Alice Smith/i }));
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: FAKE_DOC_ID,
          recipients: [
            expect.objectContaining({
              email: "alice@example.com",
              name: "Alice Smith",
              role: "signer",
            }),
          ],
        })
      );
    });

    test("calls onSuccess after successful submission", async () => {
      const user = userEvent.setup();
      mockUseMutation.mockResolvedValue(undefined);
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      const onSuccess = vi.fn();
      renderDialog({ onSuccess });

      await user.click(screen.getByRole("button", { name: /Alice Smith/i }));
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(onSuccess).toHaveBeenCalledOnce();
    });

    test("calls onOpenChange(false) after successful submission", async () => {
      const user = userEvent.setup();
      mockUseMutation.mockResolvedValue(undefined);
      const members = makeMembers([
        { email: "alice@example.com", name: "Alice Smith" },
      ]);
      mockUseQuery.mockReturnValue(members);
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });

      await user.click(screen.getByRole("button", { name: /Alice Smith/i }));
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Form submission — external tab", () => {
    test("calls addRecipients mutation with typed email and name on submit", async () => {
      const user = userEvent.setup();
      mockUseMutation.mockResolvedValue(undefined);
      mockUseQuery.mockReturnValue([]);
      renderDialog();

      await user.click(screen.getByRole("tab", { name: "External" }));
      await user.type(
        screen.getByLabelText("Email Address *"),
        "external@example.com"
      );
      await user.type(screen.getByLabelText("Name (Optional)"), "Jane Doe");
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: FAKE_DOC_ID,
          recipients: [
            expect.objectContaining({
              email: "external@example.com",
              name: "Jane Doe",
              role: "signer",
            }),
          ],
        })
      );
    });
  });

  describe("getInitials — via rendered avatars", () => {
    function renderWithName(name: string | undefined) {
      const members = makeMembers([{ email: "test@example.com", name }]);
      mockUseQuery.mockReturnValue(members);
      renderDialog();
    }

    afterEach(cleanup);

    test("returns first + last initial for two-word name", () => {
      renderWithName("John Doe");
      expect(screen.getByText("JD")).toBeInTheDocument();
    });

    test("returns first + last initial for three-word name", () => {
      renderWithName("Mary Jane Watson");
      expect(screen.getByText("MW")).toBeInTheDocument();
    });

    test("returns single initial for one-word name", () => {
      renderWithName("Prince");
      expect(screen.getByText("P")).toBeInTheDocument();
    });

    test("returns '?' for null name", () => {
      renderWithName(undefined);
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    test("returns '?' for empty string name", () => {
      // Empty string trims to nothing, split gives [""] — getInitials returns "?"
      // Achieved by setting name to empty string via member override
      const members = [
        {
          id: "member_0",
          email: "test@example.com",
          name: "",
          avatarUrl: null,
          status: "active",
        },
      ];
      mockUseQuery.mockReturnValue(members);
      renderDialog();
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});
