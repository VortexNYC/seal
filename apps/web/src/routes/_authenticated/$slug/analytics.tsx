/**
 * Analytics Page
 *
 * View workspace analytics and insights
 * Route: /{slug}/analytics
 */

import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/analytics")({
	component: AnalyticsPage,
	pendingComponent: () => (
		<div className="grid gap-4 md:grid-cols-2">
			<CardSkeleton />
			<CardSkeleton />
		</div>
	),
});

function AnalyticsPage() {
	return (
		<PageWrapper title="Analytics">
			<div className="space-y-6">
				<div className="grid gap-4 md:grid-cols-2">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-muted-foreground" />
								<CardTitle>Document Activity</CardTitle>
							</div>
							<CardDescription>
								Track document views and signatures
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
								Analytics data will appear here
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-muted-foreground" />
								<CardTitle>Team Performance</CardTitle>
							</div>
							<CardDescription>
								Monitor team productivity metrics
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
								Performance metrics coming soon
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</PageWrapper>
	);
}
