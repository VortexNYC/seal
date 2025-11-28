import {
	CheckCircle2Icon,
	EyeIcon,
	FileTextIcon,
	SendIcon,
	UserPlusIcon,
	XCircleIcon,
} from "lucide-react";
import { Card, CardContent } from "../ui/card";

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
		| "cancelled";
	timestamp: number;
	description: string;
	actor?: string;
}

interface ActivityFeedProps {
	events: ActivityEvent[];
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
