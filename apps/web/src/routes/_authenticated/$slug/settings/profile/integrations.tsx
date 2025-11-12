/**
 * Profile Settings Page - Integrations
 *
 * User integrations including API keys and connected applications
 * Route: /{slug}/settings/profile/integrations
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
	"/_authenticated/$slug/settings/profile/integrations",
)({
	component: IntegrationsSettings,
	pendingComponent: FormSkeleton,
});

function IntegrationsSettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Integrations</CardTitle>
					<CardDescription>
						Manage API keys and connected applications
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						Integrations settings coming soon
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
