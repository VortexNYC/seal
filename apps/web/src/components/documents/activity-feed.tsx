import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
	BellIcon,
	CheckCircle2Icon,
	EyeIcon,
	FileTextIcon,
	SendIcon,
	Share2Icon,
	UserMinusIcon,
	UserPlusIcon,
	XCircleIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

interface ActivityEvent {
	type:
		| "created"
		| "recipient_added"
		| "sent"
		| "viewed"
		| "signed"
		| "approved"
		| "declined"
		| "completed"
		| "cancelled"
		| "reminder_sent"
		| "shared"
		| "access_revoked";
	timestamp: number;
	description: string;
	actor?: string;
}

interface ActivityFeedProps {
	events: ActivityEvent[];
}

interface ConnectedActivityFeedProps {
	documentId: Id<"documents">;
	limit?: number;
	showHeader?: boolean;
	className?: string;
}

function getEventIcon(type: ActivityEvent["type"]) {
	switch (type) {
		case "created":
			return <FileTextIcon className="h-4 w-4 text-muted-foreground" />;
		case "recipient_added":
			return <UserPlusIcon className="h-4 w-4 text-blue-500" />;
		case "sent":
			return <SendIcon className="h-4 w-4 text-blue-500" />;
		case "viewed":
			return <EyeIcon className="h-4 w-4 text-blue-500" />;
		case "signed":
		case "approved":
			return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
		case "declined":
			return <XCircleIcon className="h-4 w-4 text-destructive" />;
		case "completed":
			return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
		case "cancelled":
			return <XCircleIcon className="h-4 w-4 text-muted-foreground" />;
		case "reminder_sent":
			return <BellIcon className="h-4 w-4 text-amber-500" />;
		case "shared":
			return <Share2Icon className="h-4 w-4 text-indigo-500" />;
		case "access_revoked":
			return <UserMinusIcon className="h-4 w-4 text-gray-500" />;
		default:
			return <FileTextIcon className="h-4 w-4 text-muted-foreground" />;
	}
}

function formatTimestamp(timestamp: number) {
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
		year: timestamp < Date.now() - 31536000000 ? "numeric" : undefined,
	});
}

export function ActivityFeed({ events }: ActivityFeedProps) {
	if (events.length === 0) {
		return (
			<Card>
				<CardContent>
					<div className="text-sm text-muted-foreground">No activity yet</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent>
				<div className="space-y-4">
					{events.map((event, index) => (
						<div key={index} className="flex gap-3">
							<div className="mt-0.5">{getEventIcon(event.type)}</div>
							<div className="flex-1 space-y-1">
								<p className="text-sm">{event.description}</p>
								<p className="text-xs text-muted-foreground">
									{formatTimestamp(event.timestamp)}
								</p>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * ConnectedActivityFeed - ActivityFeed that fetches its own data
 *
 * A self-contained component that queries the document activity
 * and displays it in the ActivityFeed format.
 */
export function ConnectedActivityFeed({
	documentId,
	limit = 20,
	showHeader = true,
	className,
}: ConnectedActivityFeedProps) {
	const events = useQuery(api.documents.activity_queries.getDocumentActivity, {
		documentId,
		limit,
	});

	if (events === undefined) {
		return <ActivityFeedSkeleton showHeader={showHeader} />;
	}

	if (events.length === 0) {
		return (
			<Card className={className}>
				{showHeader && (
					<CardHeader className="pb-3">
						<CardTitle className="text-base font-medium">Activity</CardTitle>
					</CardHeader>
				)}
				<CardContent>
					<div className="text-sm text-muted-foreground text-center py-4">
						No activity yet
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			{showHeader && (
				<CardHeader className="pb-3">
					<CardTitle className="text-base font-medium">Activity</CardTitle>
				</CardHeader>
			)}
			<CardContent>
				<div className="space-y-4">
					{events.map((event, index) => (
						<div key={index} className="flex gap-3">
							<div className="mt-0.5">{getEventIcon(event.type)}</div>
							<div className="flex-1 space-y-1">
								<p className="text-sm">{event.description}</p>
								<p className="text-xs text-muted-foreground">
									{formatTimestamp(event.timestamp)}
								</p>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ActivityFeedSkeleton({ showHeader }: { showHeader: boolean }) {
	return (
		<Card>
			{showHeader && (
				<CardHeader className="pb-3">
					<Skeleton className="h-5 w-20" />
				</CardHeader>
			)}
			<CardContent>
				<div className="space-y-4" role="status" aria-label="Loading activity">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="flex gap-3">
							<Skeleton className="h-4 w-4 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-16" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
