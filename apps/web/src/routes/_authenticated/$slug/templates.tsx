/**
 * Templates Page
 *
 * Manage document templates
 * Route: /{slug}/templates
 */

import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/templates")({
	component: TemplatesPage,
	pendingComponent: CardSkeleton,
});

function TemplatesPage() {
	return (
		<PageWrapper title="Templates">
			<div className="space-y-6">
				<p className="text-muted-foreground">
					Manage and create document templates
				</p>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FileText className="h-5 w-5 text-muted-foreground" />
							<CardTitle>Document Templates</CardTitle>
						</div>
						<CardDescription>
							Create reusable templates for your documents
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
							Templates functionality coming soon
						</div>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
