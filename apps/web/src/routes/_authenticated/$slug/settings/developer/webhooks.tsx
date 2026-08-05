/**
 * Developer Settings - Webhooks
 *
 * Core VortexWebhookSettingsSurface for HTTPS endpoints + thin Seal Slack
 * Incoming Webhook connector. Route: /{slug}/settings/developer/webhooks
 */

import { api } from "@seal/backend/convex/_generated/api";
import { WEBHOOK_EVENT_TYPES } from "@seal/backend/convex/schemas/webhooks";
import { createFileRoute } from "@tanstack/react-router";
import {
  getVortexWebhookMutationErrorMessage,
  type VortexWebhookSettingsFunctionReferences,
  VortexWebhookSettingsSurface,
} from "@vortexnyc/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/webhooks"
)({
  component: WebhooksPage,
  pendingComponent: FormSkeleton,
});

type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

function createRequestId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

const webhookSurfaceRefs = {
  archiveEndpoint: api.webhooks.vortex_surface.archiveEndpoint,
  createEndpoint: api.webhooks.vortex_surface.createEndpoint,
  disableEndpoint: api.webhooks.vortex_surface.disableEndpoint,
  listEndpoints: api.webhooks.vortex_surface.listEndpoints,
  listExhaustedDeliveries: api.webhooks.vortex_surface.listExhaustedDeliveries,
  listRecentDeliveries: api.webhooks.vortex_surface.listRecentDeliveries,
  removeEndpoint: api.webhooks.vortex_surface.removeEndpoint,
  retryDelivery: api.webhooks.vortex_surface.retryDelivery,
  rotateEndpointSecret: api.webhooks.vortex_surface.rotateEndpointSecret,
  sendTest: api.webhooks.vortex_surface.sendTest,
  triggerProcessing: api.webhooks.vortex_surface.triggerProcessing,
  updateEndpoint: api.webhooks.vortex_surface.updateEndpoint,
} satisfies VortexWebhookSettingsFunctionReferences;

function WebhooksPage() {
  const { canUseWebhooks, isLoading } = useSubscriptionLimits();
  const enabled = canUseWebhooks && !isLoading;

  return (
    <PageWrapper
      description="Receive real-time HTTPS events and optional Slack notifications."
      title="Webhooks"
    >
      <FeatureGate
        description="Outbound webhook endpoints and delivery history require Professional."
        feature="Webhooks"
        tier="pro"
      >
        <div className="space-y-8">
          <VortexWebhookSettingsSurface
            confirmDeleteEndpoint={async () => {
              return window.confirm(
                "Permanently delete this archived webhook endpoint and its delivery history?"
              );
            }}
            copy={{
              create: {
                urlPlaceholder: "https://example.com/webhooks/seal",
              },
              deliveries: {
                emptyMessage: "No webhook deliveries yet.",
              },
              endpoints: {
                emptyMessage: "No webhook endpoints configured yet.",
              },
              exhaustedDeliveries: {
                emptyMessage: "No exhausted webhook deliveries.",
              },
            }}
            createRequestId={createRequestId}
            enabled={enabled}
            eventOptions={WEBHOOK_EVENT_TYPES}
            getErrorMessage={getVortexWebhookMutationErrorMessage}
            refs={webhookSurfaceRefs}
            renderActionError={(message) => (
              <p className="text-destructive text-sm" role="alert">
                {message}
              </p>
            )}
            renderProcessQueueButton={({ label, onClick }) => (
              <Button
                onClick={onClick}
                size="sm"
                type="button"
                variant="outline"
              >
                {label}
              </Button>
            )}
            renderSecret={({ secret, title }) => (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>
                    Copy it now — it will not be shown again.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="bg-muted block rounded-md p-3 text-xs break-all">
                    {secret}
                  </code>
                </CardContent>
              </Card>
            )}
            renderTag={(label) => <Badge variant="secondary">{label}</Badge>}
          />

          <SlackNotificationsSection enabled={enabled} />
        </div>
      </FeatureGate>
    </PageWrapper>
  );
}

function SlackNotificationsSection({ enabled }: { enabled: boolean }) {
  const endpoints = useQuery(api.webhooks.queries.listEndpoints);
  const slackEndpoints =
    endpoints?.filter((endpoint) => endpoint.format === "slack") ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle>Slack notifications</CardTitle>
          <CardDescription>
            Paste a Slack Incoming Webhook URL for document event alerts.
            Seal-only connector — not part of the Core HTTPS surface.
          </CardDescription>
        </div>
        <ConnectSlackDialog disabled={!enabled} />
      </CardHeader>
      <CardContent>
        {slackEndpoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No Slack channels connected yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {slackEndpoints.map((endpoint) => (
              <li
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                key={endpoint._id}
              >
                <div>
                  <p className="font-medium">{endpoint.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {endpoint.url}
                  </p>
                </div>
                <Badge
                  variant={
                    endpoint.status === "active" ? "default" : "secondary"
                  }
                >
                  {endpoint.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectSlackDialog({ disabled }: { disabled: boolean }) {
  const createSlackEndpoint = useMutation(
    api.webhooks.mutations.createSlackEndpoint
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Slack");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([
    "document.completed",
    "document.sent",
    "recipient.signed",
  ]);
  const [saving, setSaving] = useState(false);

  const toggleEvent = (event: WebhookEventType, checked: boolean) => {
    setSelectedEvents((current) => {
      if (checked) {
        return current.includes(event) ? current : [...current, event];
      }
      return current.filter((value) => value !== event);
    });
  };

  const handleCreate = () => {
    if (saving) {
      return;
    }
    if (!url.trim()) {
      toast.error("Paste your Slack Incoming Webhook URL");
      return;
    }
    setSaving(true);
    void createSlackEndpoint({
      name: name.trim() || "Slack",
      url: url.trim(),
      events: selectedEvents,
    })
      .then(() => {
        toast.success("Slack channel connected");
        setOpen(false);
        setUrl("");
        setName("Slack");
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to connect Slack"
        );
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button">
          Connect Slack
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Slack channel</DialogTitle>
          <DialogDescription>
            Use a Slack Incoming Webhook URL from hooks.slack.com.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-name">Name</Label>
            <Input
              id="slack-name"
              onChange={(event) => {
                setName(event.target.value);
              }}
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slack-url">Webhook URL</Label>
            <Input
              id="slack-url"
              onChange={(event) => {
                setUrl(event.target.value);
              }}
              placeholder="https://hooks.slack.com/services/..."
              value={url}
            />
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              {WEBHOOK_EVENT_TYPES.map((event) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={event}
                  htmlFor={`slack-event-${event}`}
                >
                  <Checkbox
                    checked={selectedEvents.includes(event)}
                    id={`slack-event-${event}`}
                    onCheckedChange={(checked) => {
                      toggleEvent(event, checked === true);
                    }}
                  />
                  <span className="font-mono text-xs">{event}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={handleCreate} type="button">
            {saving ? "Connecting..." : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
