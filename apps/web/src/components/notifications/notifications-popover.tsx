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
			return <Share2Icon className="h-4 w-4 text-blue-500" />;
		case "access_revoked":
		case "bulk_access_revoked":
			return <ShieldAlertIcon className="h-4 w-4 text-red-500" />;
		case "access_updated":
			return <KeyIcon className="h-4 w-4 text-amber-500" />;
		case "ownership_transferred":
			return <UserIcon className="h-4 w-4 text-purple-500" />;
		case "document_signed":
		case "document_completed":
		case "signature_requested":
			return <FileTextIcon className="h-4 w-4 text-green-500" />;
		case "sharing_disabled":
			return <ShieldAlertIcon className="h-4 w-4 text-orange-500" />;
		default:
			return <BellIcon className="h-4 w-4 text-gray-500" />;
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
					className="inline-flex items-center gap-1 text-[10px] text-amber-600"
					title="Email sending..."
				>
					<ClockIcon className="h-3 w-3" />
				</span>
			);
		case "sent":
			return (
				<span
					className="inline-flex items-center gap-1 text-[10px] text-green-600"
					title="Email sent"
				>
					<MailIcon className="h-3 w-3" />
					<CheckCircleIcon className="h-2.5 w-2.5" />
				</span>
			);
		case "failed":
			return (
				<span
					className="inline-flex items-center gap-1 text-[10px] text-red-600"
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
				"flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer",
				notification.read
					? "bg-transparent hover:bg-gray-50"
					: "bg-blue-50/50 hover:bg-blue-50",
			)}
			onClick={handleClick}
			onKeyDown={(e) => e.key === "Enter" && handleClick()}
		>
			<div className="flex-shrink-0 mt-0.5">
				{getNotificationIcon(notification.type)}
			</div>
			<div className="flex-1 min-w-0">
				<p
					className={cn(
						"text-sm leading-tight",
						notification.read ? "text-gray-600" : "text-gray-900 font-medium",
					)}
				>
					{getNotificationMessage(notification)}
				</p>
				<div className="flex items-center gap-2 mt-1">
					<span className="text-xs text-gray-400">
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
					<div className="h-2 w-2 rounded-full bg-blue-500" />
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
		<div className="flex flex-col items-center justify-center py-8 px-4 text-center">
			<div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
				<BellIcon className="h-6 w-6 text-gray-400" />
			</div>
			<p className="text-sm font-medium text-gray-900">No notifications</p>
			<p className="text-xs text-gray-500 mt-1">You're all caught up!</p>
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
							className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
						>
							{unreadCount && unreadCount > 99 ? "99+" : unreadCount}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
				<div className="flex items-center justify-between px-4 py-3 border-b">
					<h3 className="font-medium text-sm">Notifications</h3>
					{hasUnread && (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
							onClick={handleMarkAllAsRead}
						>
							<CheckIcon className="h-3 w-3 mr-1" />
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
						<div className="p-2 space-y-1">
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
					<div className="px-4 py-3 border-t text-center">
						<Button variant="ghost" size="sm" className="text-xs text-gray-500">
							<Loader2Icon className="h-3 w-3 mr-1 animate-spin" />
							Load more
						</Button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
