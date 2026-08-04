import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mocks must be hoisted before component import
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => mockUseMutation,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <a {...props}>{children}</a>,
}));

import { NotificationsPopover } from "./notifications-popover";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NotificationItem = {
  _id: Id<"notifications">;
  _creationTime: number;
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  type: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: number;
  emailStatus?: string;
  lastEmailError?: string;
};

function makeNotification(
  overrides: Partial<NotificationItem> = {}
): NotificationItem {
  return {
    _id: "notif_1" as Id<"notifications">,
    _creationTime: Date.now(),
    userId: "user_1" as Id<"users">,
    organizationId: "org_1" as Id<"organizations">,
    type: "document_signed",
    data: {
      documentName: "My Contract",
      signedBy: "Alice",
      remainingSigners: 0,
    },
    read: false,
    createdAt: Date.now() - 60_000, // 1 minute ago
    ...overrides,
  };
}

function makeNotificationList(items: NotificationItem[] = [], hasMore = false) {
  return { items, hasMore };
}

/** Render the component and set up useQuery to return the given state. */
function renderPopover(
  queryReturn: {
    notifications: ReturnType<typeof makeNotificationList> | undefined;
    unreadCount: number | undefined;
  } = {
    notifications: makeNotificationList(),
    unreadCount: 0,
  },
  slug = "my-workspace"
) {
  mockUseQuery.mockImplementation((_ref: unknown, _args: unknown) => {
    // Differentiate calls by examining args object shape
    if (_args && typeof _args === "object" && "limit" in _args) {
      return queryReturn.notifications;
    }
    // getUnreadCount has {}
    return queryReturn.unreadCount;
  });

  return render(<NotificationsPopover slug={slug} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotificationsPopover", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
  });

  // -------------------------------------------------------------------------
  // Trigger button always renders
  // -------------------------------------------------------------------------

  describe("trigger button", () => {
    test("renders bell icon button with aria-label 'Notifications'", () => {
      renderPopover();
      expect(
        screen.getByRole("button", { name: "Notifications" })
      ).toBeInTheDocument();
    });

    test("does not show unread badge when unreadCount is 0", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 0 });
      // The badge text would be "0" or a number — absence of any badge number
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    test("does not show unread badge when unreadCount is undefined (loading)", () => {
      renderPopover({ notifications: undefined, unreadCount: undefined });
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    test("shows unread badge with count when unreadCount is 1", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 1 });
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    test("shows unread badge with count when unreadCount is 5", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 5 });
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    test("shows '99+' when unread count is exactly 100", () => {
      renderPopover({
        notifications: makeNotificationList(),
        unreadCount: 100,
      });
      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    test("shows '99+' when unread count exceeds 99", () => {
      renderPopover({
        notifications: makeNotificationList(),
        unreadCount: 250,
      });
      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    test("shows exact count when unreadCount is exactly 99", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 99 });
      expect(screen.getByText("99")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Popover content (requires a click to open under happy-dom + Radix)
  // -------------------------------------------------------------------------

  describe("popover content after opening", () => {
    test("shows 'Notifications' heading after opening", async () => {
      const user = userEvent.setup();
      renderPopover({ notifications: makeNotificationList(), unreadCount: 0 });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });

    test("shows skeleton loading state when notifications are undefined", async () => {
      const user = userEvent.setup();
      renderPopover({ notifications: undefined, unreadCount: undefined });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      // The skeleton renders 3 skeleton rows — verify by the structured DOM
      // (skeletons don't have accessible text, but we know no notification content renders)
      expect(screen.queryByText("No notifications")).not.toBeInTheDocument();
      expect(
        screen.queryByText("You're all caught up!")
      ).not.toBeInTheDocument();
    });

    test("shows empty state when notification list is empty", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("No notifications")).toBeInTheDocument();
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });

    test("does not show 'Mark all read' button when there are no unread notifications", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.queryByRole("button", { name: /mark all read/i })
      ).not.toBeInTheDocument();
    });

    test("shows 'Mark all read' button when there are unread notifications", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([
          makeNotification({ read: false }),
        ]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByRole("button", { name: /mark all read/i })
      ).toBeInTheDocument();
    });

    test("calls markAllAsRead mutation when 'Mark all read' is clicked", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([
          makeNotification({ read: false }),
        ]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      await user.click(screen.getByRole("button", { name: /mark all read/i }));
      expect(mockUseMutation).toHaveBeenCalledWith({});
    });
  });

  // -------------------------------------------------------------------------
  // Notification item rendering
  // -------------------------------------------------------------------------

  describe("notification items", () => {
    test("renders document_signed notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_signed",
        data: {
          documentName: "My Contract",
          signedBy: "Alice",
          remainingSigners: 0,
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText('"My Contract" was signed')).toBeInTheDocument();
    });

    test("renders document_completed notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_completed",
        data: { documentName: "Q4 Report", totalSigners: 2 },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('"Q4 Report" is fully signed')
      ).toBeInTheDocument();
    });

    test("renders document_shared notification message with sharedByName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_shared",
        data: {
          documentName: "Budget Sheet",
          sharedBy: "user_2" as Id<"users">,
          sharedByName: "Bob",
          permissionLevel: "view",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Bob shared "Budget Sheet" with you')
      ).toBeInTheDocument();
    });

    test("renders document_shared notification message without sharedByName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_shared",
        data: {
          documentName: "Budget Sheet",
          sharedBy: "user_2" as Id<"users">,
          permissionLevel: "view",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('You were given access to "Budget Sheet"')
      ).toBeInTheDocument();
    });

    test("renders access_revoked notification message with revokedByName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "access_revoked",
        data: {
          documentName: "Private Doc",
          revokedByName: "Admin Carol",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Admin Carol revoked your access to "Private Doc"')
      ).toBeInTheDocument();
    });

    test("renders signature_requested notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "signature_requested",
        data: { documentName: "NDA Agreement" },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Your signature is requested on "NDA Agreement"')
      ).toBeInTheDocument();
    });

    test("renders reminder notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "reminder",
        data: { documentName: "Lease Agreement", reminderType: "sign" },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Reminder: "Lease Agreement" needs your attention')
      ).toBeInTheDocument();
    });

    test("renders sharing_disabled notification with documentsAffected count", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "sharing_disabled",
        data: { reason: "plan_downgrade", documentsAffected: 3 },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText("Sharing was disabled for 3 document(s)")
      ).toBeInTheDocument();
    });

    test("renders ownership_transferred notification with previousOwnerName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "ownership_transferred",
        data: {
          documentName: "Company Bylaws",
          previousOwnerId: "user_3" as Id<"users">,
          previousOwnerName: "Dave",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Dave transferred "Company Bylaws" to you')
      ).toBeInTheDocument();
    });

    test("renders bulk_access_revoked notification with removedUserName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "bulk_access_revoked",
        data: {
          documentName: "All Docs",
          reason: "removed",
          removedUserName: "Eve",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Eve\'s access to "All Docs" was revoked')
      ).toBeInTheDocument();
    });

    test("renders access_updated notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "access_updated",
        data: {
          documentName: "Roadmap",
          oldPermissionLevel: "view",
          newPermissionLevel: "edit",
          updatedBy: "user_4" as Id<"users">,
          updatedByName: "Frank",
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(
        screen.getByText('Frank changed your access to "Roadmap" to edit')
      ).toBeInTheDocument();
    });

    test("renders unread indicator dot for unread notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ read: false });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      // The unread dot uses bg-info (semantic token) with rounded-full
      const dot = document.querySelector(".bg-info.rounded-full");
      expect(dot).toBeInTheDocument();
    });

    test("does not render unread indicator dot for read notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ read: true });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      const dot = document.querySelector(".bg-info.rounded-full");
      expect(dot).not.toBeInTheDocument();
    });

    test("wraps notification in a link when documentId is present", async () => {
      const user = userEvent.setup();
      const docId = "doc_123" as Id<"documents">;
      const notif = makeNotification({
        type: "document_signed",
        data: {
          documentId: docId,
          documentName: "Linked Doc",
          signedBy: "Alice",
          remainingSigners: 0,
        },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      // The Link mock renders an <a> element without href so it won't have ARIA role "link".
      // Query by tag name instead — confirm the anchor wraps the notification content.
      const anchor = document.querySelector("a.block");
      expect(anchor).toBeInTheDocument();
    });

    test("does not wrap notification in a link when documentId is absent", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "sharing_disabled",
        data: { reason: "plan_downgrade", documentsAffected: 2 },
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    test("calls markAsRead when clicking an unread notification without a documentId", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "sharing_disabled",
        data: { reason: "plan_downgrade", documentsAffected: 1 },
        read: false,
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      await user.click(
        screen.getByText("Sharing was disabled for 1 document(s)")
      );
      expect(mockUseMutation).toHaveBeenCalledWith({
        notificationId: notif._id,
      });
    });

    test("does not call markAsRead when clicking an already-read notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "sharing_disabled",
        data: { reason: "plan_downgrade", documentsAffected: 1 },
        read: true,
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      mockUseMutation.mockReset();
      await user.click(
        screen.getByText("Sharing was disabled for 1 document(s)")
      );
      expect(mockUseMutation).not.toHaveBeenCalled();
    });

    test("renders multiple notifications in order", async () => {
      const user = userEvent.setup();
      const notif1 = makeNotification({
        _id: "notif_a" as Id<"notifications">,
        type: "document_signed",
        data: { documentName: "Doc A", signedBy: "Alice", remainingSigners: 0 },
      });
      const notif2 = makeNotification({
        _id: "notif_b" as Id<"notifications">,
        type: "document_completed",
        data: { documentName: "Doc B", totalSigners: 1 },
      });
      renderPopover({
        notifications: makeNotificationList([notif1, notif2]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText('"Doc A" was signed')).toBeInTheDocument();
      expect(screen.getByText('"Doc B" is fully signed')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Relative time formatting (indirectly via rendered notification)
  // -------------------------------------------------------------------------

  describe("formatRelativeTime (via rendered notification)", () => {
    test("shows 'Just now' for a very recent notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ createdAt: Date.now() - 5_000 }); // 5 seconds ago
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("Just now")).toBeInTheDocument();
    });

    test("shows minutes ago for a notification from several minutes ago", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ createdAt: Date.now() - 5 * 60_000 }); // 5 minutes ago
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("5m ago")).toBeInTheDocument();
    });

    test("shows hours ago for a notification from several hours ago", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        createdAt: Date.now() - 3 * 60 * 60_000,
      }); // 3 hours ago
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("3h ago")).toBeInTheDocument();
    });

    test("shows days ago for a notification from yesterday", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        createdAt: Date.now() - 2 * 24 * 60 * 60_000,
      }); // 2 days ago
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("2d ago")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // "Load more" footer
  // -------------------------------------------------------------------------

  describe("load more footer", () => {
    test("does not show 'Load more' when hasMore is false", async () => {
      const user = userEvent.setup();
      const notif = makeNotification();
      renderPopover({
        notifications: makeNotificationList([notif], false),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.queryByText(/load more/i)).not.toBeInTheDocument();
    });

    test("shows 'Load more' button when hasMore is true", async () => {
      const user = userEvent.setup();
      const notif = makeNotification();
      renderPopover({
        notifications: makeNotificationList([notif], true),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText(/load more/i)).toBeInTheDocument();
    });
  });
});
