import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
	AlertCircleIcon,
	BellIcon,
	CheckCircleIcon,
	ClockIcon,
	XCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

interface ReminderHistoryPanelProps {
	documentId: Id<"documents">;
	limit?: number;
	className?: string;
}

type ReminderStatus = "scheduled" | "pending" | "sent" | "failed" | "cancelled";

/**
 * ReminderHistoryPanel - Shows reminder history for a document
 *
 * Displays all sent/failed reminders with status badges
 * and recipient information.
 */
export function ReminderHistoryPanel({
	documentId,
	limit = 10,
	className,
}: ReminderHistoryPanelProps) {
	const history = useQuery(api.documents.reminders_queries.getReminderHistory, {
		documentId,
		limit,
	});

	const stats = useQuery(api.documents.reminders_queries.getReminderStats, {
		documentId,
	});

	if (history === undefined || stats === undefined) {
		return <ReminderHistoryPanelSkeleton />;
	}

	return (
		<Card className={className}>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-medium flex items-center gap-2">
						<BellIcon className="h-4 w-4" />
						Reminder History
					</CardTitle>
					{stats.total > 0 && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{stats.sent} sent</span>
							{stats.failed > 0 && (
								<span className="text-red-500">{stats.failed} failed</span>
							)}
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{history.length === 0 ? (
					<div className="text-sm text-muted-foreground text-center py-6">
						<BellIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
						<p>No reminders sent yet</p>
					</div>
				) : (
					<div className="space-y-3">
						{history.map((reminder) => (
							<ReminderHistoryItem key={reminder._id} reminder={reminder} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

interface ReminderHistoryItemProps {
	reminder: {
		_id: string;
		status: ReminderStatus;
		type: "manual" | "automated";
		sentAt?: number;
		failedAt?: number;
		scheduledFor: number;
		lastError?: string;
		attemptCount?: number;
		recipient: {
			email: string;
			name?: string;
			role: string;
		} | null;
	};
}

function ReminderHistoryItem({ reminder }: ReminderHistoryItemProps) {
	const statusTime =
		reminder.sentAt || reminder.failedAt || reminder.scheduledFor;

	return (
		<div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
			<div className="mt-0.5">{getStatusIcon(reminder.status)}</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-sm font-medium truncate">
						{reminder.recipient?.name || reminder.recipient?.email || "Unknown"}
					</span>
					<StatusBadge status={reminder.status} />
					{reminder.type === "automated" && (
						<Badge variant="outline" className="text-xs">
							<ClockIcon className="h-3 w-3 mr-1" />
							Auto
						</Badge>
					)}
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					{formatReminderTime(statusTime)}
				</p>
				{reminder.status === "failed" && reminder.lastError && (
					<p className="text-xs text-red-500 mt-1 flex items-center gap-1">
						<AlertCircleIcon className="h-3 w-3" />
						{reminder.lastError}
					</p>
				)}
			</div>
		</div>
	);
}

function getStatusIcon(status: ReminderStatus) {
	switch (status) {
		case "sent":
			return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
		case "failed":
			return <XCircleIcon className="h-4 w-4 text-red-500" />;
		case "scheduled":
			return <ClockIcon className="h-4 w-4 text-blue-500" />;
		case "pending":
			return <ClockIcon className="h-4 w-4 text-amber-500" />;
		case "cancelled":
			return <XCircleIcon className="h-4 w-4 text-muted-foreground" />;
		default:
			return <BellIcon className="h-4 w-4 text-muted-foreground" />;
	}
}

function StatusBadge({ status }: { status: ReminderStatus }) {
	const config: Record<ReminderStatus, { label: string; className: string }> = {
		scheduled: {
			label: "Scheduled",
			className: "bg-blue-100 text-blue-700 border-blue-200",
		},
		pending: {
			label: "Pending",
			className: "bg-amber-100 text-amber-700 border-amber-200",
		},
		sent: {
			label: "Sent",
			className: "bg-green-100 text-green-700 border-green-200",
		},
		failed: {
			label: "Failed",
			className: "bg-red-100 text-red-700 border-red-200",
		},
		cancelled: {
			label: "Cancelled",
			className: "bg-gray-100 text-gray-600 border-gray-200",
		},
	};

	const { label, className: badgeClassName } = config[status];

	return (
		<Badge variant="outline" className={cn("text-xs", badgeClassName)}>
			{label}
		</Badge>
	);
}

function formatReminderTime(timestamp: number) {
	const now = Date.now();
	const diff = now - timestamp;

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return new Date(timestamp).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function ReminderHistoryPanelSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-4 w-16" />
				</div>
			</CardHeader>
			<CardContent>
				<div
					className="space-y-3"
					role="status"
					aria-label="Loading reminder history"
				>
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
						>
							<Skeleton className="h-4 w-4 rounded-full" />
							<div className="flex-1 space-y-2">
								<div className="flex items-center gap-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-5 w-12 rounded-full" />
								</div>
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
