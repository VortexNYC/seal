import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  disconnectConnectedApp,
  getConnectedApps,
  getIntegrationActivity,
  type ApiConnectedApp,
  type ApiIntegrationActivityLog,
} from "@/lib/api-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/integrations"
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
  const { data: connectedApps } = useQuery({
    queryKey: ["api", "users", "me", "connected-apps"],
    queryFn: getConnectedApps,
  });
  const { data: activityLogs } = useQuery({
    queryKey: ["api", "users", "me", "integration-activity"],
    queryFn: getIntegrationActivity,
  });

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

function ConnectedAppsSection({ apps }: { apps: ApiConnectedApp[] }) {
  const disconnectApp = useMutation({
    mutationFn: disconnectConnectedApp,
  });

  const handleDisconnect = async (appId: string) => {
    try {
      await disconnectApp.mutateAsync(appId);
      toast.success("App disconnected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disconnect app"
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
            <Unplug className="text-muted-foreground/50 h-12 w-12" />
            <p className="text-muted-foreground mt-4 text-sm">
              No connected apps
            </p>
            <p className="text-muted-foreground text-xs">
              Apps you authorize will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => (
              <div
                key={app.id}
                className="flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{app.appName}</span>
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
                  <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:items-center">
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
                      className="min-h-[44px] self-end sm:min-h-0 sm:self-center"
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
                        onClick={() => handleDisconnect(app.id)}
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

function ActivityLogsSection({ logs }: { logs: ApiIntegrationActivityLog[] }) {
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
            <Clock className="text-muted-foreground/50 h-12 w-12" />
            <p className="text-muted-foreground mt-4 text-sm">
              No activity yet
            </p>
            <p className="text-muted-foreground text-xs">
              Integration activity will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
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
                  <p className="text-muted-foreground text-sm">
                    {log.action}
                    {log.details && ` - ${log.details}`}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap">
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
