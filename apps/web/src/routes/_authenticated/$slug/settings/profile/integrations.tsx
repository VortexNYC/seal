import { api } from "@seal/backend/convex/_generated/api";
import type { Doc } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Activity, Clock, Link2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { FormSkeleton } from "@/components/skeletons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return formatDate(timestamp);
}

function IntegrationsSettings() {
	const connectedApps = useQuery(api.api_keys.queries.listConnectedApps);
	const activityLogs = useQuery(api.api_keys.queries.listIntegrationActivity);

	if (!connectedApps || !activityLogs) {
		return <FormSkeleton />;
	}

	return (
		<div className="space-y-6">
			<ConnectedAppsSection apps={connectedApps} />
			<ActivityLogsSection logs={activityLogs} />
		</div>
	);
}

function ConnectedAppsSection({ apps }: { apps: Doc<"connected_apps">[] }) {
	const disconnectApp = useMutation(api.api_keys.mutations.disconnectApp);

	const handleDisconnect = async (appId: Doc<"connected_apps">["_id"]) => {
		try {
			await disconnectApp({ appId });
			toast.success("App disconnected");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to disconnect app",
			);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Link2 className="h-5 w-5" />
					<CardTitle>Connected Apps</CardTitle>
				</div>
				<CardDescription>
					Third-party applications connected to your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				{apps.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Unplug className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-sm text-muted-foreground">
							No connected apps
						</p>
						<p className="text-xs text-muted-foreground">
							Apps you authorize will appear here
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{apps.map((app) => (
							<div
								key={app._id}
								className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-4 gap-4"
							>
								<div className="space-y-1 min-w-0 flex-1">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="font-medium truncate">{app.appName}</span>
										{app.active ? (
											<Badge variant="default" className="text-xs">
												Active
											</Badge>
										) : (
											<Badge variant="secondary" className="text-xs">
												Inactive
											</Badge>
										)}
									</div>
									<div className="flex flex-col sm:flex-row sm:items-center gap-1 text-sm text-muted-foreground">
										<span>Connected {formatDate(app.connectedAt)}</span>
										{app.lastActivityAt && (
											<>
												<span className="hidden sm:inline">•</span>
												<span>
													Last active {formatRelativeTime(app.lastActivityAt)}
												</span>
											</>
										)}
									</div>
									<div className="flex flex-wrap gap-1 pt-1">
										{app.scopes.map((scope) => (
											<Badge key={scope} variant="outline" className="text-xs">
												{scope}
											</Badge>
										))}
									</div>
								</div>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="outline"
											size="sm"
											className="min-h-[44px] sm:min-h-0 self-end sm:self-center"
										>
											<Unplug className="mr-1 h-3 w-3" />
											Disconnect
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Disconnect {app.appName}
											</AlertDialogTitle>
											<AlertDialogDescription>
												This will revoke {app.appName}'s access to your account.
												The app will no longer be able to access your data.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => handleDisconnect(app._id)}
											>
												Disconnect
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ActivityLogsSection({
	logs,
}: {
	logs: Doc<"integration_activity_logs">[];
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Activity className="h-5 w-5" />
					<CardTitle>Activity Log</CardTitle>
				</div>
				<CardDescription>
					Recent integration activity on your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				{logs.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Clock className="h-12 w-12 text-muted-foreground/50" />
						<p className="mt-4 text-sm text-muted-foreground">
							No activity yet
						</p>
						<p className="text-xs text-muted-foreground">
							Integration activity will appear here
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{logs.map((log) => (
							<div
								key={log._id}
								className="flex items-start justify-between border-b pb-3 last:border-0"
							>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Badge
											variant={log.type === "api_key" ? "default" : "secondary"}
											className="text-xs"
										>
											{log.type === "api_key" ? "API Key" : "Connected App"}
										</Badge>
										<span className="font-medium">{log.integrationName}</span>
									</div>
									<p className="text-sm text-muted-foreground">
										{log.action}
										{log.details && ` - ${log.details}`}
									</p>
								</div>
								<span className="text-xs text-muted-foreground whitespace-nowrap">
									{formatRelativeTime(log.createdAt)}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
