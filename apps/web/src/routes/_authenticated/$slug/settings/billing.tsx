/**
 * Billing Settings Page
 *
 * Manage organization billing and subscription
 * Route: /{slug}/settings/billing
 */

import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
	component: BillingSettingsPage,
	pendingComponent: CardSkeleton,
});

function BillingSettingsPage() {
	return (
		<PageWrapper title="Billing">
			<div className="space-y-6">
				<p className="text-sm text-muted-foreground">
					Manage your subscription and billing information
				</p>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<CreditCard className="h-5 w-5 text-muted-foreground" />
							<CardTitle>Subscription & Billing</CardTitle>
						</div>
						<CardDescription>
							View and manage your subscription plan and payment methods
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
							Billing management coming soon
						</div>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
