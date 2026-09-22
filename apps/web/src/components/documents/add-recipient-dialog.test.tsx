import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockUseOrganizationMembers = vi.hoisted(() => vi.fn());
const mockAddRecipients = vi.hoisted(() => vi.fn());
const mockGetContacts = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-organization-members", () => ({
  useOrganizationMembers: (...args: unknown[]) =>
    mockUseOrganizationMembers(...args),
}));

vi.mock("@/lib/api-client", () => ({
  addRecipients: mockAddRecipients,
  getContacts: mockGetContacts,
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { AddRecipientDialog } from "./add-recipient-dialog";

const FAKE_DOC_ID = "fake_doc";
const FAKE_SLUG = "fake_org";

type Member = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
  status: string;
};

function makeMembers(overrides: Partial<Member>[] = []): Member[] {
  return overrides.map((o, i) => ({
    userId: `member_${i}`,
    email: `member${i}@example.com`,
    name: `Member ${i}`,
    role: "member",
    avatarUrl: null,
    status: "active",
    ...o,
  }));
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
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
    documentPublicId: FAKE_DOC_ID,
    slug: FAKE_SLUG,
    organizationSlug: FAKE_SLUG,
    open: true,
    onOpenChange: vi.fn<(open: boolean) => void>(),
    onSuccess: vi.fn<() => void>(),
    existingRecipientEmails: [] as string[],
    currentUserEmail: undefined as string | undefined,
    ...overrides,
  };
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AddRecipientDialog {...props} />
    </QueryClientProvider>
  );
  return props;
}

describe("AddRecipientDialog", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockAddRecipients.mockReset();
    mockGetContacts.mockReset();
    mockUseOrganizationMembers.mockReset();
    mockAddRecipients.mockResolvedValue(undefined);
    mockGetContacts.mockResolvedValue([]);
    mockUseOrganizationMembers.mockReturnValue({ data: [] });
  });

  describe("open / closed visibility", () => {
    test("does not render dialog content when open is false", () => {
      renderDialog({ open: false });
      expect(screen.queryByText("Add Recipient")).not.toBeInTheDocument();
    });

    test("renders 'Add Recipient' title when open is true", () => {
      renderDialog({ open: true });
      expect(
        screen.getByRole("heading", { name: "Add Recipient" })
      ).toBeInTheDocument();
    });

    test("renders description when open", () => {
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
      mockUseOrganizationMembers.mockReturnValue({ data: undefined });
      renderDialog();
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeTruthy();
    });

    test("does not show the member list while loading", () => {
      mockUseOrganizationMembers.mockReturnValue({ data: undefined });
      renderDialog();
      expect(
        screen.queryByRole("button", { name: /member/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Team tab — empty state", () => {
    test("shows 'No team members available' when member list is empty and no existing recipients", () => {
      mockUseOrganizationMembers.mockReturnValue({ data: [] });
      renderDialog({ existingRecipientEmails: [] });
      expect(screen.getByText("No team members available")).toBeInTheDocument();
    });

    test("shows 'All team members have been added' when members are non-empty but all filtered out", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([{ email: "alice@example.com" }]),
      });
      renderDialog({ existingRecipientEmails: ["alice@example.com"] });
      expect(
        screen.getByText("All team members have been added")
      ).toBeInTheDocument();
    });

    test("filters out current user from team list", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "self@example.com", name: "Self" },
          { email: "other@example.com", name: "Other" },
        ]),
      });
      renderDialog({ currentUserEmail: "self@example.com" });
      expect(screen.queryByText("Self")).not.toBeInTheDocument();
      expect(screen.getByText("Other")).toBeInTheDocument();
    });

    test("filters out existing recipients from team list", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "added@example.com", name: "Already Added" },
          { email: "new@example.com", name: "New Person" },
        ]),
      });
      renderDialog({ existingRecipientEmails: ["added@example.com"] });
      expect(screen.queryByText("Already Added")).not.toBeInTheDocument();
      expect(screen.getByText("New Person")).toBeInTheDocument();
    });

    test("filters out inactive members", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          {
            email: "inactive@example.com",
            name: "Inactive User",
            status: "inactive",
          },
          {
            email: "active@example.com",
            name: "Active User",
            status: "active",
          },
        ]),
      });
      renderDialog();
      expect(screen.queryByText("Inactive User")).not.toBeInTheDocument();
      expect(screen.getByText("Active User")).toBeInTheDocument();
    });

    test("shows 'All team members have been added' when all remaining members are filtered out by existing recipients", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "self@example.com", name: "Self", status: "active" },
          {
            email: "added@example.com",
            name: "Already Added",
            status: "active",
          },
          {
            email: "inactive@example.com",
            name: "Inactive",
            status: "inactive",
          },
        ]),
      });
      renderDialog({
        currentUserEmail: "self@example.com",
        existingRecipientEmails: ["added@example.com"],
      });
      expect(
        screen.getByText("All team members have been added")
      ).toBeInTheDocument();
    });
  });

  describe("Team tab — member list", () => {
    test("renders eligible member names and emails", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
          { email: "bob@example.com", name: "Bob Jones" },
        ]),
      });
      renderDialog();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });

    test("shows member count in the Team tab trigger", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "a@example.com" },
          { email: "b@example.com" },
        ]),
      });
      renderDialog();
      expect(screen.getByText("Team (2)")).toBeInTheDocument();
    });

    test("renders avatar initials for a member with two-word name", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
      renderDialog();
      expect(screen.getByText("AS")).toBeInTheDocument();
    });

    test("renders avatar initials for a member with single-word name", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([{ email: "alice@example.com", name: "Alice" }]),
      });
      renderDialog();
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    test("renders '?' as avatar fallback when member name is null/undefined", () => {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([{ email: "anon@example.com", name: undefined }]),
      });
      renderDialog();
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    test("selecting a member enables the submit button", async () => {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
      renderDialog();

      const addButton = screen.getByRole("button", { name: "Add Recipient" });
      expect(addButton).toBeDisabled();

      const memberRow = screen.getByRole("button", { name: /Alice Smith/i });
      await user.click(memberRow);

      expect(addButton).not.toBeDisabled();
    });

    test("shows check icon next to selected member", async () => {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
      renderDialog();

      const memberRow = screen.getByRole("button", { name: /Alice Smith/i });
      await user.click(memberRow);

      expect(memberRow.className).toContain("bg-accent");
    });
  });

  describe("External tab", () => {
    async function switchToExternal() {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({ data: [] });
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
      renderDialog();
      expect(screen.getByLabelText("Role")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    test("shows role description for signer by default", () => {
      renderDialog();
      expect(
        screen.getByText("This person must sign the document.")
      ).toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    test("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderDialog({ onOpenChange });

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Form submission — team tab", () => {
    test("calls addRecipients mutation with selected member details on submit", async () => {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
      const onSuccess = vi.fn();
      renderDialog({ onSuccess });

      await user.click(screen.getByRole("button", { name: /Alice Smith/i }));
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(mockAddRecipients).toHaveBeenCalledWith(FAKE_SLUG, FAKE_DOC_ID, [
        {
          email: "alice@example.com",
          name: "Alice Smith",
          role: "signer",
        },
      ]);
    });

    test("calls onSuccess after successful submission", async () => {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
      const onSuccess = vi.fn();
      renderDialog({ onSuccess });

      await user.click(screen.getByRole("button", { name: /Alice Smith/i }));
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(onSuccess).toHaveBeenCalledOnce();
    });

    test("calls onOpenChange(false) after successful submission", async () => {
      const user = userEvent.setup();
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([
          { email: "alice@example.com", name: "Alice Smith" },
        ]),
      });
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
      renderDialog();

      await user.click(screen.getByRole("tab", { name: "External" }));
      await user.type(
        screen.getByLabelText("Email Address *"),
        "external@example.com"
      );
      await user.type(screen.getByLabelText("Name (Optional)"), "Jane Doe");
      await user.click(screen.getByRole("button", { name: "Add Recipient" }));

      expect(mockAddRecipients).toHaveBeenCalledWith(FAKE_SLUG, FAKE_DOC_ID, [
        {
          email: "external@example.com",
          name: "Jane Doe",
          role: "signer",
        },
      ]);
    });
  });

  describe("getInitials — via rendered avatars", () => {
    function renderWithName(name: string | undefined) {
      mockUseOrganizationMembers.mockReturnValue({
        data: makeMembers([{ email: "test@example.com", name }]),
      });
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
      mockUseOrganizationMembers.mockReturnValue({
        data: [
          {
            userId: "member_0",
            email: "test@example.com",
            name: "",
            avatarUrl: null,
            status: "active",
            role: "member",
          },
        ],
      });
      renderDialog();
      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});
