import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { AlertDialog } from "@cloudflare/kumo/primitives/alert-dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Clock, Link2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { FormSkeleton } from "@/components/skeletons";
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
    <LayerCard>
      <LayerCard.Secondary>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          <Text as="h2" variant="heading">
            Connected Apps
          </Text>
        </div>
        <Text variant="secondary">
          Third-party applications connected to your account
        </Text>
      </LayerCard.Secondary>
      <LayerCard.Primary>
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
                      <Badge variant="primary">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
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
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
                <AlertDialog.Root>
                  <AlertDialog.Trigger
                    render={
                      <Button variant="outline" size="sm">
                        <Unplug className="mr-1 h-3 w-3" />
                        Disconnect
                      </Button>
                    }
                  />
                  <AlertDialog.Portal>
                    <AlertDialog.Backdrop />
                    <AlertDialog.Popup>
                      <AlertDialog.Title>
                        Disconnect {app.appName}
                      </AlertDialog.Title>
                      <AlertDialog.Description>
                        This will revoke {app.appName}'s access to your account.
                        The app will no longer be able to access your data.
                      </AlertDialog.Description>
                      <div className="mt-4 flex justify-end gap-2">
                        <AlertDialog.Close
                          render={<Button variant="outline">Cancel</Button>}
                        />
                        <AlertDialog.Close
                          onClick={() => handleDisconnect(app.id)}
                          render={<Button>Disconnect</Button>}
                        />
                      </div>
                    </AlertDialog.Popup>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </div>
            ))}
          </div>
        )}
      </LayerCard.Primary>
    </LayerCard>
  );
}

function ActivityLogsSection({ logs }: { logs: ApiIntegrationActivityLog[] }) {
  return (
    <LayerCard>
      <LayerCard.Secondary>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <Text as="h2" variant="heading">
            Activity Log
          </Text>
        </div>
        <Text variant="secondary">
          Recent integration activity on your account
        </Text>
      </LayerCard.Secondary>
      <LayerCard.Primary>
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
                      variant={log.type === "api_key" ? "primary" : "secondary"}
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
      </LayerCard.Primary>
    </LayerCard>
  );
}
