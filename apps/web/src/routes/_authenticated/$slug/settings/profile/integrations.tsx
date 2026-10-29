import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Link as Link2, Plugs as Unplug, Pulse as Activity } from "@phosphor-icons/react";
import { useState } from "react";

import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton } from "@/components/skeletons";
import {
  disconnectConnectedApp,
  getConnectedApps,
  getIntegrationActivity,
  type ApiConnectedApp,
  type ApiIntegrationActivityLog,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

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
  const {
    data: connectedApps,
    isPending: appsPending,
    isError: appsError,
    error: appsErr,
  } = useQuery({
    queryKey: ["api", "users", "me", "connected-apps"],
    queryFn: getConnectedApps,
  });
  const {
    data: activityLogs,
    isPending: logsPending,
    isError: logsError,
    error: logsErr,
  } = useQuery({
    queryKey: ["api", "users", "me", "integration-activity"],
    queryFn: getIntegrationActivity,
  });

  if (appsPending || logsPending) {
    return <FormSkeleton />;
  }

  if (appsError || logsError) {
    return (
      <LayerCard>
        <LayerCard.Primary className="py-10 text-center">
          <Text as="p" variant="secondary">
            Could not load integrations
          </Text>
          <Text as="p" variant="secondary" size="sm">
            {(appsErr ?? logsErr) instanceof Error
              ? (appsErr ?? logsErr)?.message
              : "Try again in a moment."}
          </Text>
        </LayerCard.Primary>
      </LayerCard>
    );
  }

  return (
    <SettingsBody>
      <div className="flex flex-col gap-5">
        <ConnectedAppsSection apps={connectedApps ?? []} />
        <ActivityLogsSection logs={activityLogs ?? []} />
      </div>
    </SettingsBody>
  );
}

function ConnectedAppsSection({ apps }: { apps: ApiConnectedApp[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = apps.find((app) => app.id === pendingId);
  const disconnectApp = useMutation({
    mutationFn: disconnectConnectedApp,
  });

  const handleDisconnect = async (appId: string): Promise<void> => {
    try {
      await disconnectApp.mutateAsync(appId);
      setPendingId(null);
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
            <Unplug className="text-kumo-secondary/50 h-12 w-12" />
            <Text as="p" variant="secondary" size="sm" DANGEROUS_className="mt-4">No connected apps</Text>
            <Text as="p" variant="secondary" size="xs">Apps you authorize will appear here</Text>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => (
              <LayerCard
                key={app.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
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
                  <div className="text-kumo-secondary flex flex-col gap-1 text-sm sm:flex-row sm:items-center">
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
                <Button
                  variant="outline"
                  size="sm"
                  icon={Unplug}
                  onClick={() => setPendingId(app.id)}
                >
                  Disconnect
                </Button>
              </LayerCard>
            ))}
          </div>
        )}
      </LayerCard.Primary>
      <Dialog.Root
        open={pending !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingId(null);
        }}
        role="alertdialog"
      >
        <Dialog className="p-6">
          <Dialog.Title>Disconnect {pending?.appName}</Dialog.Title>
          <Dialog.Description>
            This will revoke {pending?.appName}&apos;s access to your account.
            The app will no longer be able to access your data.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="outline">Cancel</Button>} />
            <Button
              loading={disconnectApp.isPending}
              onClick={() => {
                if (pendingId) void handleDisconnect(pendingId);
              }}
            >
              Disconnect
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
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
            <Clock className="text-kumo-secondary/50 h-12 w-12" />
            <Text as="p" variant="secondary" size="sm" DANGEROUS_className="mt-4">No activity yet</Text>
            <Text as="p" variant="secondary" size="xs">Integration activity will appear here</Text>
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
                  <Text as="p" variant="secondary" size="sm">{log.action}
                    {log.details && ` - ${log.details}`}</Text>
                </div>
                <span className="text-kumo-secondary text-xs whitespace-nowrap">
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
