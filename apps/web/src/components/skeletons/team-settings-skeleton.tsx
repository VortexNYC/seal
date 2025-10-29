/**
 * TeamSettingsSkeleton Component
 *
 * Loading skeleton for the team settings page.
 * Shows tabs and list of members.
 *
 * @example
 * ```tsx
 * // In route definition
 * export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
 *   component: TeamSettings,
 *   pendingComponent: TeamSettingsSkeleton,
 * });
 * ```
 */

import { PageWrapper } from "@/components/page-wrapper";
import { ListSkeleton } from "@/components/skeletons/list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TeamSettingsSkeleton() {
	return (
		<PageWrapper title="Team">
			<Tabs defaultValue="members" className="w-full">
				<TabsList>
					<TabsTrigger value="members">Members</TabsTrigger>
					<TabsTrigger value="invitations">Invitations</TabsTrigger>
				</TabsList>
				<TabsContent value="members" className="space-y-4">
					<Skeleton className="h-9 w-full max-w-md" />
					<ListSkeleton count={5} showAvatar showSecondaryText />
				</TabsContent>
				<TabsContent value="invitations" className="space-y-4">
					<ListSkeleton count={3} showAvatar={false} showSecondaryText />
				</TabsContent>
			</Tabs>
		</PageWrapper>
	);
}
