/**
 * General Settings Page
 *
 * Organization general settings
 * Route: /{slug}/settings
 */

import { createFileRoute } from "@tanstack/react-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
	component: GeneralSettings,
});

function GeneralSettings() {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">General</h3>
				<p className="text-sm text-muted-foreground">
					Manage your workspace general settings
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Workspace Information</CardTitle>
					<CardDescription>
						Update your workspace name and other details
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						General settings coming soon
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
