/**
 * Profile Settings Page - Usage
 *
 * User usage statistics and analytics
 * Route: /{slug}/settings/profile/usage
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
	"/_authenticated/$slug/settings/profile/usage",
)({
	component: UsageSettings,
	pendingComponent: FormSkeleton,
});

function UsageSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Usage Statistics</CardTitle>
					<CardDescription>
						View your account usage and activity statistics
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						Usage statistics coming soon
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
