import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  KeyIcon,
  Loader2Icon,
  MailIcon,
  Share2Icon,
  ShieldAlertIcon,
  UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Skeleton } from "../ui/skeleton";

type Notification = Doc<"notifications">;

interface NotificationsPopoverProps {
  slug: string;
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

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "document_shared":
      return <Share2Icon className="text-info h-4 w-4" />;
    case "access_revoked":
    case "bulk_access_revoked":
      return <ShieldAlertIcon className="text-destructive h-4 w-4" />;
    case "access_updated":
      return <KeyIcon className="text-warning h-4 w-4" />;
    case "ownership_transferred":
      return <UserIcon className="text-ai-accent h-4 w-4" />;
    case "document_signed":
    case "document_completed":
    case "signature_requested":
      return <FileTextIcon className="text-success h-4 w-4" />;
    case "sharing_disabled":
      return <ShieldAlertIcon className="text-warning h-4 w-4" />;
    default:
      return <BellIcon className="text-muted-foreground h-4 w-4" />;
  }
}

function getNotificationMessage(notification: Notification): string {
  const data = notification.data;
  const documentName =
    "documentName" in data ? (data.documentName ?? "a document") : "a document";

  switch (notification.type) {
    case "document_shared": {
      if ("sharedByName" in data && data.sharedByName) {
        return `${data.sharedByName} shared "${documentName}" with you`;
      }
      return `You were given access to "${documentName}"`;
    }
    case "access_revoked": {
      if ("revokedByName" in data && data.revokedByName) {
        return `${data.revokedByName} revoked your access to "${documentName}"`;
      }
      if ("message" in data && data.message) {
        return data.message;
      }
      return `Your access to "${documentName}" was revoked`;
    }
    case "access_updated": {
      if ("newPermissionLevel" in data && "updatedByName" in data) {
        const level = data.newPermissionLevel;
        const updater = data.updatedByName ?? "Someone";
        return `${updater} changed your access to "${documentName}" to ${level}`;
      }
      return `Your access to "${documentName}" was updated`;
    }
    case "ownership_transferred": {
      if ("message" in data && data.message) {
        return data.message;
      }
      if ("previousOwnerName" in data && data.previousOwnerName) {
        return `${data.previousOwnerName} transferred "${documentName}" to you`;
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
      if ("message" in data && data.message) {
        return data.message;
      }
      if ("documentsAffected" in data) {
        return `Sharing was disabled for ${data.documentsAffected} document(s)`;
      }
      return "Document sharing was disabled";
    }
    case "bulk_access_revoked": {
      if ("message" in data && data.message) {
        return data.message;
      }
      if ("removedUserName" in data && data.removedUserName) {
        return `${data.removedUserName}'s access to "${documentName}" was revoked`;
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
  status: Notification["emailStatus"];
  lastError?: string;
}) {
  if (!status || status === "not_applicable") return null;

  switch (status) {
    case "pending":
      return (
        <span
          className="text-warning inline-flex items-center gap-1 text-[10px]"
          title="Email sending..."
        >
          <ClockIcon className="h-3 w-3" />
        </span>
      );
    case "sent":
      return (
        <span
          className="text-success inline-flex items-center gap-1 text-[10px]"
          title="Email sent"
        >
          <MailIcon className="h-3 w-3" />
          <CheckCircleIcon className="h-2.5 w-2.5" />
        </span>
      );
    case "failed":
      return (
        <span
          className="text-destructive inline-flex items-center gap-1 text-[10px]"
          title={lastError ?? "Email failed to send"}
        >
          <MailIcon className="h-3 w-3" />
          <AlertCircleIcon className="h-2.5 w-2.5" />
        </span>
      );
    default:
      return null;
  }
}

function NotificationItem({
  notification,
  slug,
  onMarkAsRead,
}: {
  notification: Notification;
  slug: string;
  onMarkAsRead: (id: Id<"notifications">) => void;
}) {
  const documentId =
    "documentId" in notification.data
      ? notification.data.documentId
      : undefined;

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
          ? "hover:bg-muted bg-transparent"
          : "bg-info-surface/50 hover:bg-info-surface"
      )}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="mt-0.5 flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-tight",
            notification.read
              ? "text-muted-foreground"
              : "text-foreground font-medium"
          )}
        >
          {getNotificationMessage(notification)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(notification.createdAt)}
          </span>
          <EmailStatusIndicator
            status={notification.emailStatus}
            lastError={notification.lastEmailError}
          />
        </div>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0">
          <div className="bg-info h-2 w-2 rounded-full" />
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
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="bg-muted mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <BellIcon className="text-muted-foreground h-6 w-6" />
      </div>
      <p className="text-foreground text-sm font-medium">No notifications</p>
      <p className="text-muted-foreground mt-1 text-xs">
        You're all caught up!
      </p>
    </div>
  );
}

export function NotificationsPopover({ slug }: NotificationsPopoverProps) {
  const notifications = useQuery(api.notifications.index.list, { limit: 20 });
  const unreadCount = useQuery(api.notifications.index.getUnreadCount, {});
  const markAsRead = useMutation(api.notifications.index.markAsRead);
  const markAllAsRead = useMutation(api.notifications.index.markAllAsRead);

  const handleMarkAsRead = (notificationId: Id<"notifications">) => {
    markAsRead({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead({});
  };

  const isLoading = notifications === undefined;
  const hasNotifications =
    notifications?.items && notifications.items.length > 0;
  const hasUnread = (unreadCount ?? 0) > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Notifications"
        >
          <BellIcon className="h-4 w-4" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px]"
            >
              {unreadCount && unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-medium">Notifications</h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="text-info hover:bg-info-surface hover:text-info h-7 text-xs"
              onClick={handleMarkAllAsRead}
            >
              <CheckIcon className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <NotificationsSkeleton />
          ) : !hasNotifications ? (
            <EmptyState />
          ) : (
            <div className="space-y-1 p-2">
              {notifications.items.map((notification) => (
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

        {hasNotifications && notifications.hasMore && (
          <div className="border-t px-4 py-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
            >
              <Loader2Icon className="mr-1 h-3 w-3 animate-spin" />
              Load more
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
