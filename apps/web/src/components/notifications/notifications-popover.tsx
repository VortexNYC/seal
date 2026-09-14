import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Text } from "@cloudflare/kumo/components/text";
import {
  Bell,
  Check,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  FileText,
  Key,
  ShareNetwork,
  ShieldWarning,
  User,
  Warning,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import type {
  ApiNotification,
  ApiNotificationEmailStatus,
  ApiNotificationType,
} from "@/lib/api-client";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Notification = ApiNotification;

interface NotificationsPopoverProps {
  slug: string;
  organizationSlug: string;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getNotificationIcon(type: ApiNotificationType) {
  switch (type) {
    case "document_shared":
      return <ShareNetwork className="text-kumo-info size-4" />;
    case "access_revoked":
    case "bulk_access_revoked":
      return <ShieldWarning className="text-kumo-danger size-4" />;
    case "access_updated":
      return <Key className="text-kumo-warning size-4" />;
    case "ownership_transferred":
      return <User className="text-ai-accent size-4" />;
    case "document_signed":
    case "document_completed":
    case "signature_requested":
      return <FileText className="text-kumo-success size-4" />;
    case "sharing_disabled":
      return <ShieldWarning className="text-kumo-warning size-4" />;
    default:
      return <Bell className="text-kumo-secondary size-4" />;
  }
}

function getString(
  data: Record<string, unknown>,
  key: string
): string | undefined {
  if (key in data && typeof data[key] === "string") {
    return data[key];
  }
  return undefined;
}

function getNumber(
  data: Record<string, unknown>,
  key: string
): number | undefined {
  if (key in data && typeof data[key] === "number") {
    return data[key];
  }
  return undefined;
}

function getDocumentName(data: Record<string, unknown>): string {
  return getString(data, "documentName") ?? "a document";
}

function getNotificationMessage(notification: Notification): string {
  const data = notification.data;
  const documentName = getDocumentName(data);

  switch (notification.type) {
    case "document_shared": {
      const sharedByName = getString(data, "sharedByName");
      if (sharedByName) {
        return `${sharedByName} shared "${documentName}" with you`;
      }
      return `You were given access to "${documentName}"`;
    }
    case "access_revoked": {
      const revokedByName = getString(data, "revokedByName");
      if (revokedByName) {
        return `${revokedByName} revoked your access to "${documentName}"`;
      }
      const message = getString(data, "message");
      if (message) {
        return message;
      }
      return `Your access to "${documentName}" was revoked`;
    }
    case "access_updated": {
      const level = getString(data, "newPermissionLevel");
      const updater = getString(data, "updatedByName") ?? "Someone";
      if (level) {
        return `${updater} changed your access to "${documentName}" to ${level}`;
      }
      return `Your access to "${documentName}" was updated`;
    }
    case "ownership_transferred": {
      const message = getString(data, "message");
      if (message) {
        return message;
      }
      const previousOwnerName = getString(data, "previousOwnerName");
      if (previousOwnerName) {
        return `${previousOwnerName} transferred "${documentName}" to you`;
      }
      return `You are now the owner of "${documentName}"`;
    }
    case "document_signed":
      return `"${documentName}" was signed`;
    case "document_completed":
      return `"${documentName}" is fully signed`;
    case "signature_requested":
      return `Your signature is requested on "${documentName}"`;
    case "reminder":
      return `Reminder: "${documentName}" needs your attention`;
    case "sharing_disabled": {
      const message = getString(data, "message");
      if (message) {
        return message;
      }
      const documentsAffected = getNumber(data, "documentsAffected");
      if (documentsAffected !== undefined) {
        return `Sharing was disabled for ${documentsAffected} document(s)`;
      }
      return "Document sharing was disabled";
    }
    case "bulk_access_revoked": {
      const message = getString(data, "message");
      if (message) {
        return message;
      }
      const removedUserName = getString(data, "removedUserName");
      if (removedUserName) {
        return `${removedUserName}'s access to "${documentName}" was revoked`;
      }
      return `Access to "${documentName}" was revoked`;
    }
    default:
      return "You have a new notification";
  }
}

function EmailStatusIndicator({
  status,
  lastError,
}: {
  status: ApiNotificationEmailStatus | undefined;
  lastError?: string;
}) {
  if (!status || status === "not_applicable") return null;

  switch (status) {
    case "pending":
      return (
        <span
          className="text-kumo-warning inline-flex items-center gap-1 text-[10px]"
          title="Email sending..."
        >
          <Clock className="size-3" />
        </span>
      );
    case "sent":
      return (
        <span
          className="text-kumo-success inline-flex items-center gap-1 text-[10px]"
          title="Email sent"
        >
          <EnvelopeSimple className="size-3" />
          <CheckCircle className="size-2.5" />
        </span>
      );
    case "failed":
      return (
        <span
          className="text-kumo-danger inline-flex items-center gap-1 text-[10px]"
          title={lastError ?? "Email failed to send"}
        >
          <EnvelopeSimple className="size-3" />
          <Warning className="size-2.5" />
        </span>
      );
    default:
      return null;
  }
}

function getDocumentId(data: Record<string, unknown>): string | undefined {
  return getString(data, "documentId");
}

function NotificationItem({
  notification,
  slug,
  onMarkAsRead,
}: {
  notification: Notification;
  slug: string;
  onMarkAsRead: (id: string) => void;
}) {
  const documentId = getDocumentId(notification.data);

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification._id);
    }
  };

  const content = (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors",
        notification.read
          ? "hover:bg-kumo-elevated bg-transparent"
          : "bg-kumo-info-tint/50 hover:bg-kumo-info-tint"
      )}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="mt-0.5 flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="min-w-0 flex-1">
        <Text
          as="p"
          size="sm"
          variant="body"
          DANGEROUS_className={cn(
            "leading-tight",
            notification.read
              ? "text-kumo-secondary"
              : "text-kumo-primary font-medium"
          )}
        >
          {getNotificationMessage(notification)}
        </Text>
        <div className="mt-1 flex items-center gap-2">
          <Text as="span" size="xs" variant="secondary">
            {formatRelativeTime(notification.createdAt)}
          </Text>
          <EmailStatusIndicator
            status={notification.emailStatus}
            lastError={notification.lastEmailError}
          />
        </div>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0">
          <div className="bg-kumo-info h-2 w-2 rounded-full" />
        </div>
      )}
    </div>
  );

  if (documentId) {
    return (
      <Link
        to="/$slug/documents/$documentId"
        params={{ slug, documentId }}
        className="block"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3">
          <div className="bg-kumo-elevated h-4 w-4 animate-pulse rounded" />
          <div className="flex-1 space-y-2">
            <div className="bg-kumo-elevated h-4 w-full animate-pulse rounded" />
            <div className="bg-kumo-elevated h-3 w-16 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsPopover({
  slug,
  organizationSlug,
}: NotificationsPopoverProps) {
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["api", "notifications", organizationSlug],
    queryFn: () => getNotifications(organizationSlug, 20),
  });
  const { data: unreadCount } = useQuery({
    queryKey: ["api", "notifications", "unread-count", organizationSlug],
    queryFn: () => getUnreadNotificationCount(organizationSlug),
  });
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(organizationSlug, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["api", "notifications"],
      });
    },
  });
  const markAllAsReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(organizationSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["api", "notifications"],
      });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const hasNotifications = (notifications?.length ?? 0) > 0;
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="relative size-8"
            aria-label="Notifications"
            icon={Bell}
          >
            {hasUnread && (
              <Badge
                variant="error"
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]"
              >
                {unreadCount && unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <Popover.Content
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-[380px] p-0"
      >
        <div className="border-kumo-hairline flex items-center justify-between border-b px-4 py-3">
          <Text as="h3" size="lg" variant="heading">
            Notifications
          </Text>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="text-kumo-info hover:bg-kumo-info-tint hover:text-kumo-info h-7 text-xs"
              onClick={handleMarkAllAsRead}
              icon={Check}
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <NotificationsSkeleton />
          ) : !hasNotifications ? (
            <Empty
              size="base"
              icon={<Bell className="size-6" />}
              title="No notifications"
              description="You're all caught up!"
            />
          ) : (
            <div className="space-y-1 p-2">
              {notifications?.map((notification) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  slug={slug}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover>
  );
}
