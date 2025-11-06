/**
 * Profile Settings Page - Notifications
 *
 * User notification preferences management
 * Route: /{slug}/settings/profile/notifications
 */

import { createFileRoute } from "@tanstack/react-router";
import { FormSkeleton } from "@/components/skeletons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/profile/notifications",
)({
	component: NotificationSettings,
	pendingComponent: FormSkeleton,
});

function NotificationSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Notification Preferences</CardTitle>
					<CardDescription>
						Configure how and when you receive notifications
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						Notification settings coming soon
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
