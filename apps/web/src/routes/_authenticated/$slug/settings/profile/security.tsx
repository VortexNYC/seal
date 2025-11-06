/**
 * Profile Settings Page - Security
 *
 * User security settings including password, MFA, and session management
 * Route: /{slug}/settings/profile/security
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
	"/_authenticated/$slug/settings/profile/security",
)({
	component: SecuritySettings,
	pendingComponent: FormSkeleton,
});

function SecuritySettings() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Security Settings</CardTitle>
					<CardDescription>
						Manage your password, two-factor authentication, and active sessions
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						Security settings coming soon
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
