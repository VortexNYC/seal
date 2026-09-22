import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ApiNotification } from "@/lib/api-client";

const mockGetNotifications = vi.hoisted(() => vi.fn());
const mockGetUnreadNotificationCount = vi.hoisted(() => vi.fn());
const mockMarkNotificationAsRead = vi.hoisted(() => vi.fn());
const mockMarkAllNotificationsAsRead = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  getNotifications: mockGetNotifications,
  getUnreadNotificationCount: mockGetUnreadNotificationCount,
  markNotificationAsRead: mockMarkNotificationAsRead,
  markAllNotificationsAsRead: mockMarkAllNotificationsAsRead,
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

function makeNotification(
  overrides: Partial<ApiNotification> = {}
): ApiNotification {
  return {
    _id: "notif_1",
    userId: "user_1",
    organizationId: "org_1",
    type: "document_signed",
    data: {
      documentName: "My Contract",
      signedBy: "Alice",
      remainingSigners: 0,
    },
    read: false,
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
    ...overrides,
  };
}

function makeNotificationList(items: ApiNotification[] = []) {
  return items;
}

/** Pending queryFns registered here are rejected on cleanup so workers never hang. */
const pendingQueryCancels: Array<(reason: Error) => void> = [];

function pendingUntilCleanup<T>(): Promise<T> {
  return new Promise<T>((_resolve, reject) => {
    pendingQueryCancels.push(reject);
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function renderPopover(
  queryReturn: {
    notifications: ApiNotification[] | undefined;
    unreadCount: number | undefined;
  } = {
    notifications: makeNotificationList(),
    unreadCount: 0,
  },
  slug = "my-workspace"
) {
  const queryClient = createQueryClient();
  const isLoading = queryReturn.notifications === undefined;

  if (isLoading) {
    // Stay pending without a forever-orphaned promise — cleanup rejects these.
    mockGetNotifications.mockImplementation(() => pendingUntilCleanup());
    mockGetUnreadNotificationCount.mockImplementation(() =>
      pendingUntilCleanup()
    );
  } else {
    mockGetNotifications.mockResolvedValue(queryReturn.notifications ?? []);
    mockGetUnreadNotificationCount.mockResolvedValue(
      queryReturn.unreadCount ?? 0
    );
    queryClient.setQueryData(
      ["api", "notifications", slug],
      queryReturn.notifications ?? []
    );
    queryClient.setQueryData(
      ["api", "notifications", "unread-count", slug],
      queryReturn.unreadCount ?? 0
    );
  }

  mockMarkNotificationAsRead.mockImplementation(
    (_organizationSlug: string, id: string) =>
      Promise.resolve(makeNotification({ _id: id, read: true }))
  );
  mockMarkAllNotificationsAsRead.mockResolvedValue(0);

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <NotificationsPopover slug={slug} organizationSlug={slug} />
      </QueryClientProvider>
    ),
    queryClient,
  };
}

describe("NotificationsPopover", () => {
  afterEach(() => {
    cleanup();
    const cancelError = new Error("test cleanup");
    for (const cancel of pendingQueryCancels.splice(0)) {
      cancel(cancelError);
    }
  });

  beforeEach(() => {
    mockGetNotifications.mockReset();
    mockGetUnreadNotificationCount.mockReset();
    mockMarkNotificationAsRead.mockReset();
    mockMarkAllNotificationsAsRead.mockReset();
  });

  describe("trigger button", () => {
    test("renders bell icon button with aria-label 'Notifications'", () => {
      renderPopover();
      expect(
        screen.getByRole("button", { name: "Notifications" })
      ).toBeDefined();
    });

    test("does not show unread badge when unreadCount is 0", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 0 });
      expect(screen.queryByText("0")).toBeNull();
    });

    test("does not show unread badge when unreadCount is undefined (loading)", () => {
      renderPopover({ notifications: undefined, unreadCount: undefined });
      expect(screen.queryByText("0")).toBeNull();
    });

    test("shows unread badge with count when unreadCount is 1", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 1 });
      expect(screen.getByText("1")).toBeDefined();
    });

    test("shows unread badge with count when unreadCount is 5", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 5 });
      expect(screen.getByText("5")).toBeDefined();
    });

    test("shows '99+' when unread count is exactly 100", () => {
      renderPopover({
        notifications: makeNotificationList(),
        unreadCount: 100,
      });
      expect(screen.getByText("99+")).toBeDefined();
    });

    test("shows '99+' when unread count exceeds 99", () => {
      renderPopover({
        notifications: makeNotificationList(),
        unreadCount: 250,
      });
      expect(screen.getByText("99+")).toBeDefined();
    });

    test("shows exact count when unreadCount is exactly 99", () => {
      renderPopover({ notifications: makeNotificationList(), unreadCount: 99 });
      expect(screen.getByText("99")).toBeDefined();
    });
  });

  describe("popover content after opening", () => {
    test("shows 'Notifications' heading after opening", async () => {
      const user = userEvent.setup();
      renderPopover({ notifications: makeNotificationList(), unreadCount: 0 });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("Notifications")).toBeDefined();
    });

    test("shows skeleton loading state when notifications are undefined", async () => {
      const user = userEvent.setup();
      renderPopover({ notifications: undefined, unreadCount: undefined });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.queryByText("No notifications")).toBeNull();
      expect(screen.queryByText("You're all caught up!")).toBeNull();
    });

    test("shows empty state when notification list is empty", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("No notifications")).toBeDefined();
      expect(screen.getByText("You're all caught up!")).toBeDefined();
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
      ).toBeNull();
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
      ).toBeDefined();
    });

    test("calls markAllNotificationsAsRead when 'Mark all read' is clicked", async () => {
      const user = userEvent.setup();
      renderPopover({
        notifications: makeNotificationList([
          makeNotification({ read: false }),
        ]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      await user.click(screen.getByRole("button", { name: /mark all read/i }));
      expect(mockMarkAllNotificationsAsRead).toHaveBeenCalled();
    });
  });

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
      expect(screen.getByText('"My Contract" was signed')).toBeDefined();
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
      expect(screen.getByText('"Q4 Report" is fully signed')).toBeDefined();
    });

    test("renders document_shared notification message with sharedByName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_shared",
        data: {
          documentName: "Budget Sheet",
          sharedBy: "user_2",
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
      ).toBeDefined();
    });

    test("renders document_shared notification message without sharedByName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_shared",
        data: {
          documentName: "Budget Sheet",
          sharedBy: "user_2",
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
      ).toBeDefined();
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
      ).toBeDefined();
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
      ).toBeDefined();
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
      ).toBeDefined();
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
      ).toBeDefined();
    });

    test("renders ownership_transferred notification with previousOwnerName", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "ownership_transferred",
        data: {
          documentName: "Company Bylaws",
          previousOwnerId: "user_3",
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
      ).toBeDefined();
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
      ).toBeDefined();
    });

    test("renders access_updated notification message", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "access_updated",
        data: {
          documentName: "Roadmap",
          oldPermissionLevel: "view",
          newPermissionLevel: "edit",
          updatedBy: "user_4",
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
      ).toBeDefined();
    });

    test("renders unread indicator dot for unread notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ read: false });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 1,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      const dot = document.querySelector(".bg-info.rounded-full");
      expect(dot).toBeDefined();
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
      expect(dot).toBeNull();
    });

    test("wraps notification in a link when documentId is present", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        type: "document_signed",
        data: {
          documentId: "doc_123",
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
      const anchor = document.querySelector("a.block");
      expect(anchor).toBeDefined();
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
      expect(screen.queryByRole("link")).toBeNull();
    });

    test("calls markNotificationAsRead when clicking an unread notification without a documentId", async () => {
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
      expect(mockMarkNotificationAsRead.mock.calls[0]?.[1]).toBe("notif_1");
    });

    test("does not call markNotificationAsRead when clicking an already-read notification", async () => {
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
      mockMarkNotificationAsRead.mockReset();
      await user.click(
        screen.getByText("Sharing was disabled for 1 document(s)")
      );
      expect(mockMarkNotificationAsRead).not.toHaveBeenCalled();
    });

    test("renders multiple notifications in order", async () => {
      const user = userEvent.setup();
      const notif1 = makeNotification({
        _id: "notif_a",
        type: "document_signed",
        data: { documentName: "Doc A", signedBy: "Alice", remainingSigners: 0 },
      });
      const notif2 = makeNotification({
        _id: "notif_b",
        type: "document_completed",
        data: { documentName: "Doc B", totalSigners: 1 },
      });
      renderPopover({
        notifications: makeNotificationList([notif1, notif2]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText('"Doc A" was signed')).toBeDefined();
      expect(screen.getByText('"Doc B" is fully signed')).toBeDefined();
    });
  });

  describe("formatRelativeTime", () => {
    test("shows 'Just now' for a very recent notification", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ createdAt: Date.now() - 5_000 });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("Just now")).toBeDefined();
    });

    test("shows minutes ago for a notification from several minutes ago", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({ createdAt: Date.now() - 5 * 60_000 });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("5m ago")).toBeDefined();
    });

    test("shows hours ago for a notification from several hours ago", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        createdAt: Date.now() - 3 * 60 * 60_000,
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("3h ago")).toBeDefined();
    });

    test("shows days ago for a notification from yesterday", async () => {
      const user = userEvent.setup();
      const notif = makeNotification({
        createdAt: Date.now() - 2 * 24 * 60 * 60_000,
      });
      renderPopover({
        notifications: makeNotificationList([notif]),
        unreadCount: 0,
      });
      await user.click(screen.getByRole("button", { name: "Notifications" }));
      expect(screen.getByText("2d ago")).toBeDefined();
    });
  });
});
