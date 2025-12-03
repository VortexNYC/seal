import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
	BellIcon,
	CheckCircle2Icon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeIcon,
	FileTextIcon,
	FilterIcon,
	SendIcon,
	Share2Icon,
	UserMinusIcon,
	UserPlusIcon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";

type ActivityEventType =
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

interface ActivityEvent {
	type: ActivityEventType;
	timestamp: number;
	description: string;
	actor?: string;
	actorId?: string;
}

interface ActivityFeedProps {
	events: ActivityEvent[];
}

interface ConnectedActivityFeedProps {
	documentId: Id<"documents">;
	limit?: number;
	showHeader?: boolean;
	showFilters?: boolean;
	className?: string;
}

// Event type labels for the filter dropdown
const eventTypeLabels: Record<ActivityEventType, string> = {
	created: "Created",
	recipient_added: "Recipient Added",
	sent: "Sent",
	viewed: "Viewed",
	signed: "Signed",
	approved: "Approved",
	declined: "Declined",
	completed: "Completed",
	cancelled: "Cancelled",
	reminder_sent: "Reminder Sent",
	shared: "Shared",
	access_revoked: "Access Revoked",
};

const allEventTypes: ActivityEventType[] = [
	"created",
	"recipient_added",
	"sent",
	"viewed",
	"signed",
	"approved",
	"declined",
	"completed",
	"cancelled",
	"reminder_sent",
	"shared",
	"access_revoked",
];

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
 * and displays it in the ActivityFeed format with filtering and pagination.
 */
export function ConnectedActivityFeed({
	documentId,
	limit = 20,
	showHeader = true,
	showFilters = false,
	className,
}: ConnectedActivityFeedProps) {
	const [selectedActorId, setSelectedActorId] = useState<string | undefined>(
		undefined,
	);
	const [selectedEventTypes, setSelectedEventTypes] = useState<
		ActivityEventType[]
	>([]);
	const [currentPage, setCurrentPage] = useState(0);

	// Convert selectedActorId to proper Id type if set
	const actorIdParam = selectedActorId
		? (selectedActorId as Id<"users">)
		: undefined;

	const activityResult = useQuery(
		api.documents.activity_queries.getDocumentActivity,
		{
			documentId,
			limit,
			offset: currentPage * limit,
			actorId: actorIdParam,
			eventTypes:
				selectedEventTypes.length > 0 ? selectedEventTypes : undefined,
		},
	);

	const actors = useQuery(api.documents.activity_queries.getDocumentActors, {
		documentId,
	});

	// Reset page when filters change
	const handleActorChange = (value: string) => {
		setSelectedActorId(value === "all" ? undefined : value);
		setCurrentPage(0);
	};

	const handleEventTypeToggle = (eventType: ActivityEventType) => {
		setSelectedEventTypes((prev) =>
			prev.includes(eventType)
				? prev.filter((t) => t !== eventType)
				: [...prev, eventType],
		);
		setCurrentPage(0);
	};

	const clearEventTypeFilters = () => {
		setSelectedEventTypes([]);
		setCurrentPage(0);
	};

	if (activityResult === undefined || actors === undefined) {
		return <ActivityFeedSkeleton showHeader={showHeader} />;
	}

	const { events, total, hasMore } = activityResult;
	const totalPages = Math.ceil(total / limit);
	const hasFiltersApplied =
		selectedActorId !== undefined || selectedEventTypes.length > 0;

	if (events.length === 0 && !hasFiltersApplied) {
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
					<div className="flex items-center justify-between gap-2">
						<CardTitle className="text-base font-medium">Activity</CardTitle>
						{showFilters && (
							<div className="flex items-center gap-2">
								{/* Member Filter */}
								{actors.length > 1 && (
									<Select
										value={selectedActorId ?? "all"}
										onValueChange={handleActorChange}
									>
										<SelectTrigger className="h-8 w-[140px] text-xs">
											<SelectValue placeholder="All members" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All members</SelectItem>
											{actors.map((actor) => (
												<SelectItem key={actor.id} value={actor.id}>
													{actor.name}
													{actor.type === "owner" && " (Owner)"}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}

								{/* Event Type Filter */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="sm" className="h-8 text-xs">
											<FilterIcon className="h-3 w-3 mr-1" />
											Actions
											{selectedEventTypes.length > 0 && (
												<span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-[10px]">
													{selectedEventTypes.length}
												</span>
											)}
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-48">
										<DropdownMenuLabel className="text-xs">
											Filter by action type
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{allEventTypes.map((eventType) => (
											<DropdownMenuCheckboxItem
												key={eventType}
												checked={selectedEventTypes.includes(eventType)}
												onCheckedChange={() => handleEventTypeToggle(eventType)}
												className="text-xs"
											>
												{eventTypeLabels[eventType]}
											</DropdownMenuCheckboxItem>
										))}
										{selectedEventTypes.length > 0 && (
											<>
												<DropdownMenuSeparator />
												<Button
													variant="ghost"
													size="sm"
													className="w-full h-8 text-xs justify-start px-2"
													onClick={clearEventTypeFilters}
												>
													Clear filters
												</Button>
											</>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						)}
					</div>
				</CardHeader>
			)}
			<CardContent>
				{events.length === 0 ? (
					<div className="text-sm text-muted-foreground text-center py-4">
						No activity matches your filters
					</div>
				) : (
					<>
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

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex items-center justify-between mt-4 pt-4 border-t">
								<p className="text-xs text-muted-foreground">
									{currentPage * limit + 1}-
									{Math.min((currentPage + 1) * limit, total)} of {total}
								</p>
								<div className="flex items-center gap-1">
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
										disabled={currentPage === 0}
									>
										<ChevronLeftIcon className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										size="icon"
										className="h-7 w-7"
										onClick={() => setCurrentPage((p) => p + 1)}
										disabled={!hasMore}
									>
										<ChevronRightIcon className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
					</>
				)}
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
