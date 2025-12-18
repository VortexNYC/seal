/**
 * Workspace Home/Dashboard Page
 *
 * SEA-129: Sender Dashboard
 *
 * Main dashboard with stats, charts, recent documents, and activity
 * Route: /{slug}/home
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ArrowRightIcon,
	CheckCircle2Icon,
	ClockIcon,
	FileTextIcon,
	TrendingUpIcon,
	UploadIcon,
	UsersIcon,
} from "lucide-react";
import { Suspense, useMemo } from "react";
import {
	Area,
	AreaChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ExportDataDialog } from "@/components/dashboard/export-data-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/$slug/home")({
	component: WorkspaceHome,
	pendingComponent: DashboardSkeleton,
});

function StatsCards() {
	const { data: stats } = useSuspenseQuery(
		convexQuery(api.dashboard.queries.getDocumentStats, {}),
	);

	const monthStats = useQuery(api.dashboard.queries.getPeriodStats, {
		period: "month",
	});

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Total Documents</CardTitle>
					<FileTextIcon className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.total}</div>
					<p className="text-xs text-muted-foreground">
						{monthStats?.created ?? 0} created this month
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">
						Pending Signatures
					</CardTitle>
					<ClockIcon className="h-4 w-4 text-warning" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.pending}</div>
					<p className="text-xs text-muted-foreground">
						{stats.sent} sent, {stats.inProgress} in progress
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Completed</CardTitle>
					<CheckCircle2Icon className="h-4 w-4 text-success" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.completed}</div>
					<p className="text-xs text-muted-foreground">
						{monthStats?.completed ?? 0} completed this month
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
					<TrendingUpIcon className="h-4 w-4 text-info" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">{stats.completionRate}%</div>
					<Progress value={stats.completionRate} className="mt-2 h-2" />
				</CardContent>
			</Card>
		</div>
	);
}

function TrendChart() {
	const { data: trends } = useSuspenseQuery(
		convexQuery(api.dashboard.queries.getDocumentTrends, { days: 30 }),
	);

	const chartData = useMemo(() => {
		return trends.map((item) => ({
			...item,
			// Format date for display
			displayDate: new Date(item.date).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
		}));
	}, [trends]);

	const hasData = chartData.some((d) => d.created > 0 || d.completed > 0);

	return (
		<Card className="lg:col-span-2">
			<CardHeader className="pb-2 sm:pb-6">
				<CardTitle className="text-base sm:text-lg">
					Document Activity
				</CardTitle>
				<CardDescription className="text-xs sm:text-sm">
					Documents created and completed over the last 30 days
				</CardDescription>
			</CardHeader>
			<CardContent className="pl-0 sm:pl-6">
				{hasData ? (
					<ResponsiveContainer
						width="100%"
						height={200}
						className="sm:h-[250px]"
					>
						<AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
							<defs>
								<linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="5%"
										stopColor="hsl(var(--primary))"
										stopOpacity={0.3}
									/>
									<stop
										offset="95%"
										stopColor="hsl(var(--primary))"
										stopOpacity={0}
									/>
								</linearGradient>
								<linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
									<stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
									<stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
								</linearGradient>
							</defs>
							<XAxis
								dataKey="displayDate"
								tick={{ fontSize: 10 }}
								tickLine={false}
								axisLine={false}
								interval="preserveStartEnd"
							/>
							<YAxis
								tick={{ fontSize: 10 }}
								tickLine={false}
								axisLine={false}
								allowDecimals={false}
								width={30}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "hsl(var(--background))",
									border: "1px solid hsl(var(--border))",
									borderRadius: "6px",
									fontSize: "12px",
								}}
							/>
							<Area
								type="monotone"
								dataKey="created"
								stroke="hsl(var(--primary))"
								fillOpacity={1}
								fill="url(#colorCreated)"
								name="Created"
							/>
							<Area
								type="monotone"
								dataKey="completed"
								stroke="#22c55e"
								fillOpacity={1}
								fill="url(#colorCompleted)"
								name="Completed"
							/>
						</AreaChart>
					</ResponsiveContainer>
				) : (
					<div className="flex h-[200px] sm:h-[250px] items-center justify-center text-sm text-muted-foreground">
						No document activity yet. Create your first document to see trends.
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function RecentDocuments() {
	const { slug } = Route.useParams();
	const router = useRouter();

	const { data: recentDocs } = useSuspenseQuery(
		convexQuery(api.dashboard.queries.getRecentDocuments, { limit: 5 }),
	);

	const formatDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffHours < 1) {
			return "Just now";
		}
		if (diffHours < 24) {
			return `${diffHours}h ago`;
		}
		if (diffDays < 7) {
			return `${diffDays}d ago`;
		}
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Recent Documents</CardTitle>
					<CardDescription>Your latest documents</CardDescription>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						router.navigate({ to: "/$slug/documents", params: { slug } })
					}
				>
					View all
					<ArrowRightIcon className="ml-2 h-4 w-4" />
				</Button>
			</CardHeader>
			<CardContent>
				{recentDocs.length === 0 ? (
					<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
						No documents yet
					</div>
				) : (
					<div className="space-y-2 sm:space-y-4">
						{recentDocs.map((doc) => (
							<div
								key={doc._id}
								className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-3 sm:py-2 rounded-lg transition-colors min-h-[56px]"
								onClick={() =>
									router.navigate({
										to: "/$slug/documents/$documentId",
										params: { slug, documentId: doc._id },
									})
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										router.navigate({
											to: "/$slug/documents/$documentId",
											params: { slug, documentId: doc._id },
										});
									}
								}}
							>
								<div className="flex items-center gap-3 min-w-0 flex-1">
									<div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
										{doc.thumbnailDataUrl ? (
											<img
												src={doc.thumbnailDataUrl}
												alt=""
												className="h-full w-full object-cover"
											/>
										) : (
											<FileTextIcon className="h-5 w-5 text-muted-foreground" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium line-clamp-1 truncate">
											{doc.name}
										</p>
										<p className="text-xs text-muted-foreground">
											{formatDate(doc.updatedAt)} · {doc.signedCount}/
											{doc.recipientCount} signed
										</p>
									</div>
								</div>
								<WorkflowStatusBadge status={doc.workflowStatus} />
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function QuickActions() {
	const { slug } = Route.useParams();
	const router = useRouter();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Quick Actions</CardTitle>
				<CardDescription>Get started quickly</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				<Button
					className="w-full justify-start min-h-[44px]"
					onClick={() =>
						router.navigate({ to: "/$slug/documents", params: { slug } })
					}
				>
					<UploadIcon className="mr-2 h-4 w-4" />
					Upload Document
				</Button>
				<Button
					variant="outline"
					className="w-full justify-start min-h-[44px]"
					onClick={() =>
						router.navigate({ to: "/$slug/templates", params: { slug } })
					}
				>
					<FileTextIcon className="mr-2 h-4 w-4" />
					Use Template
				</Button>
				<Button
					variant="outline"
					className="w-full justify-start min-h-[44px]"
					onClick={() =>
						router.navigate({
							to: "/$slug/settings/team",
							params: { slug },
						})
					}
				>
					<UsersIcon className="mr-2 h-4 w-4" />
					Invite Team Member
				</Button>
			</CardContent>
		</Card>
	);
}

function StatusBreakdown() {
	const { data: stats } = useSuspenseQuery(
		convexQuery(api.dashboard.queries.getDocumentStats, {}),
	);

	const breakdown = [
		{ label: "Draft", count: stats.draft, color: "bg-gray-400" },
		{ label: "Sent", count: stats.sent, color: "bg-blue-500" },
		{ label: "In Progress", count: stats.inProgress, color: "bg-amber-500" },
		{ label: "Completed", count: stats.completed, color: "bg-green-500" },
		{ label: "Cancelled", count: stats.cancelled, color: "bg-red-400" },
		{ label: "Declined", count: stats.declined, color: "bg-red-600" },
	].filter((item) => item.count > 0);

	const total = stats.total || 1; // Prevent division by zero

	return (
		<Card>
			<CardHeader>
				<CardTitle>Status Breakdown</CardTitle>
				<CardDescription>Document distribution by status</CardDescription>
			</CardHeader>
			<CardContent>
				{breakdown.length === 0 ? (
					<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
						No documents yet
					</div>
				) : (
					<div className="space-y-3">
						{breakdown.map((item) => (
							<div key={item.label} className="flex items-center gap-3">
								<div className={`h-3 w-3 rounded-full ${item.color}`} />
								<div className="flex-1">
									<div className="flex justify-between text-sm">
										<span>{item.label}</span>
										<span className="text-muted-foreground">
											{item.count} ({Math.round((item.count / total) * 100)}%)
										</span>
									</div>
									<Progress
										value={(item.count / total) * 100}
										className="h-1.5 mt-1"
									/>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function WorkspaceHome() {
	const { slug } = Route.useParams();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const orgId = organization?._id as Id<"organizations"> | undefined;

	const memberCount = useQuery(
		api.organizations.queries.getOrganizationMemberCount,
		orgId ? { organizationId: orgId } : "skip",
	);

	// Loading state handled by pendingComponent
	if (!organization || !orgId) {
		return null;
	}

	return (
		<PageWrapper title="Dashboard" headerActions={<ExportDataDialog />}>
			<div className="space-y-6">
				{/* Stats Cards */}
				<Suspense
					fallback={
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							{Array.from({ length: 4 }).map((_, i) => (
								<Card key={i} className="animate-pulse">
									<CardHeader className="pb-2">
										<div className="h-4 bg-muted rounded w-1/2" />
									</CardHeader>
									<CardContent>
										<div className="h-8 bg-muted rounded w-1/4 mb-2" />
										<div className="h-3 bg-muted rounded w-3/4" />
									</CardContent>
								</Card>
							))}
						</div>
					}
				>
					<StatsCards />
				</Suspense>

				{/* Charts and Recent Activity */}
				<div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
					{/* Trend Chart */}
					<Suspense
						fallback={
							<Card className="lg:col-span-2">
								<CardHeader className="pb-2 sm:pb-6">
									<div className="h-5 bg-muted rounded w-1/3 mb-2" />
									<div className="h-4 bg-muted rounded w-1/2" />
								</CardHeader>
								<CardContent>
									<div className="h-[200px] sm:h-[250px] bg-muted rounded animate-pulse" />
								</CardContent>
							</Card>
						}
					>
						<TrendChart />
					</Suspense>

					{/* Status Breakdown */}
					<Suspense
						fallback={
							<Card>
								<CardHeader>
									<div className="h-5 bg-muted rounded w-1/2 mb-2" />
									<div className="h-4 bg-muted rounded w-3/4" />
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										{Array.from({ length: 4 }).map((_, i) => (
											<div key={i} className="h-6 bg-muted rounded" />
										))}
									</div>
								</CardContent>
							</Card>
						}
					>
						<StatusBreakdown />
					</Suspense>
				</div>

				{/* Recent Documents and Quick Actions */}
				<div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<Suspense
							fallback={
								<Card>
									<CardHeader>
										<div className="h-5 bg-muted rounded w-1/3 mb-2" />
										<div className="h-4 bg-muted rounded w-1/2" />
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											{Array.from({ length: 5 }).map((_, i) => (
												<div
													key={i}
													className="flex items-center gap-3 animate-pulse"
												>
													<div className="h-10 w-10 bg-muted rounded" />
													<div className="flex-1">
														<div className="h-4 bg-muted rounded w-1/2 mb-2" />
														<div className="h-3 bg-muted rounded w-1/3" />
													</div>
												</div>
											))}
										</div>
									</CardContent>
								</Card>
							}
						>
							<RecentDocuments />
						</Suspense>
					</div>

					<QuickActions />
				</div>

				{/* Team Info Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle>Team Overview</CardTitle>
							<CardDescription>{organization.name}</CardDescription>
						</div>
						<UsersIcon className="h-5 w-5 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">
							{memberCount?.active ?? 0} active members
						</div>
						<p className="text-sm text-muted-foreground">
							{memberCount?.total ?? 0} total members ·{" "}
							{(memberCount?.total ?? 0) - (memberCount?.active ?? 0)} pending
						</p>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
