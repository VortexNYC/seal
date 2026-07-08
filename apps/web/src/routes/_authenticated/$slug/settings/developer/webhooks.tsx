/**
 * Developer Settings - Webhooks
 *
 * Manage webhook endpoints for receiving real-time event notifications.
 * Route: /{slug}/settings/developer/webhooks
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Doc } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/settings/developer/webhooks")({
  component: WebhooksPage,
  pendingComponent: FormSkeleton,
});

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

type WebhookEndpointWithStats = Omit<Doc<"webhook_endpoints">, "secret" | "secretHash"> & {
  stats: {
    recentDeliveries: number;
    delivered: number;
    failed: number;
    successRate: number;
  };
};

function WebhooksPage() {
  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();
  const endpoints = useQuery(api.webhooks.queries.listEndpoints);
  const eventTypes = useQuery(api.webhooks.queries.getEventTypes);

  if (!endpoints || !eventTypes) {
    return (
      <PageWrapper
        title="Webhooks"
        description="Receive real-time notifications when events happen in Seal"
      >
        <FormSkeleton />
      </PageWrapper>
    );
  }

  const slackEndpoints = endpoints.filter((e) => e.format === "slack");
  const jsonEndpoints = endpoints.filter((e) => e.format !== "slack");

  return (
    <PageWrapper
      title="Webhooks"
      description="Receive real-time notifications when events happen in Seal"
    >
      <div className="space-y-6">
        <SlackNotificationsSection
          endpoints={slackEndpoints}
          eventTypes={eventTypes}
          isPro={isPro}
          isLoadingPlan={isLoadingPlan}
        />

        <WebhookEndpointsSection
          endpoints={jsonEndpoints}
          eventTypes={eventTypes}
          isPro={isPro}
          isLoadingPlan={isLoadingPlan}
        />

        <EventTypesReference eventTypes={eventTypes} />

        <WebhookDocumentation />
      </div>
    </PageWrapper>
  );
}

interface SlackNotificationsSectionProps {
  endpoints: WebhookEndpointWithStats[];
  eventTypes: { type: string; category: string; description: string }[];
  isPro: boolean;
  isLoadingPlan: boolean;
}

function SlackNotificationsSection({
  endpoints,
  eventTypes,
  isPro,
  isLoadingPlan,
}: SlackNotificationsSectionProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="text-ai-accent h-5 w-5" />
            <CardTitle>Slack Notifications</CardTitle>
          </div>
          {isPro ? (
            <CreateSlackDialog
              open={isCreating}
              onOpenChange={setIsCreating}
              eventTypes={eventTypes}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Professional
              </Badge>
              <Button size="sm" variant="outline" disabled>
                <Plus className="mr-1 h-4 w-4" />
                Connect Slack
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Get notified in Slack when documents are signed, sent, or completed
          {!isPro && !isLoadingPlan && (
            <span className="text-warning mt-1 block">
              Slack notifications require a Professional plan.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-2xl border">
              <Hash className="text-muted-foreground h-8 w-8" />
            </div>
            <p className="mt-6 font-mono">Connect a Slack channel</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              Paste a Slack Incoming Webhook URL to start receiving event notifications in your
              channel.
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-ai-accent hover:bg-ai-accent/90 mt-4 text-white"
              disabled={!isPro}
            >
              <Plus className="mr-2 h-4 w-4" />
              Connect Slack
            </Button>
            {!isPro && !isLoadingPlan && (
              <p className="text-warning mt-2 text-sm">Requires a Professional plan</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <WebhookEndpointRow key={endpoint._id} endpoint={endpoint} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CreateSlackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypes: { type: string; category: string; description: string }[];
}

function CreateSlackDialog({ open, onOpenChange, eventTypes }: CreateSlackDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSlackEndpoint = useMutation(api.webhooks.mutations.createSlackEndpoint);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!url.trim()) {
      toast.error("Please paste your Slack webhook URL");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSlackEndpoint({
        name: name.trim(),
        url: url.trim(),
        events: selectedEvents,
      });
      toast.success("Slack channel connected");
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Slack");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName("");
    setUrl("");
    setSelectedEvents([]);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const toggleEvent = (eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType],
    );
  };

  const toggleCategory = (category: string) => {
    const categoryEvents = eventTypes.filter((e) => e.category === category).map((e) => e.type);
    const allSelected = categoryEvents.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !categoryEvents.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...categoryEvents])]);
    }
  };

  const eventsByCategory = eventTypes.reduce(
    (acc, event) => {
      if (!acc[event.category]) acc[event.category] = [];
      acc[event.category].push(event);
      return acc;
    },
    {} as Record<string, typeof eventTypes>,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-ai-accent hover:bg-ai-accent/90 text-white">
          <Plus className="mr-1 h-4 w-4" />
          Connect Slack
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Slack Channel</DialogTitle>
          <DialogDescription>
            Paste a Slack Incoming Webhook URL to send event notifications to your channel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-name">Name</Label>
            <Input
              id="slack-name"
              placeholder="e.g., #contracts-alerts"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-url">Webhook URL</Label>
            <Input
              id="slack-url"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="font-mono"
            />
            <p className="text-muted-foreground text-xs">
              Create one at{" "}
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ai-accent hover:underline"
              >
                api.slack.com/messaging/webhooks
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Events to notify</Label>
              {selectedEvents.length > 0 && (
                <Badge variant="secondary" className="text-ai-accent">
                  {selectedEvents.length} selected
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">Leave empty to receive all events</p>
            <div className="bg-muted/30 max-h-48 space-y-4 overflow-y-auto rounded-lg border p-3">
              {Object.entries(eventsByCategory).map(([category, events]) => {
                const categorySelected = events.every((e) => selectedEvents.includes(e.type));
                const categoryPartial =
                  !categorySelected && events.some((e) => selectedEvents.includes(e.type));

                return (
                  <div key={category}>
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        id={`slack-category-${category}`}
                        checked={categorySelected}
                        ref={(el) => {
                          if (el) {
                            (el as HTMLButtonElement).dataset.state = categoryPartial
                              ? "indeterminate"
                              : undefined;
                          }
                        }}
                        onCheckedChange={() => toggleCategory(category)}
                        className="data-[state=checked]:border-ai-accent data-[state=checked]:bg-ai-accent"
                      />
                      <Label
                        htmlFor={`slack-category-${category}`}
                        className="cursor-pointer font-medium"
                      >
                        {category}
                      </Label>
                    </div>
                    <div className="ml-6 space-y-1">
                      {events.map((event) => (
                        <div key={event.type} className="flex items-start gap-2">
                          <Checkbox
                            id={`slack-${event.type}`}
                            checked={selectedEvents.includes(event.type)}
                            onCheckedChange={() => toggleEvent(event.type)}
                            className="data-[state=checked]:border-ai-accent data-[state=checked]:bg-ai-accent mt-0.5"
                          />
                          <Label
                            htmlFor={`slack-${event.type}`}
                            className="cursor-pointer text-sm font-normal"
                          >
                            <code className="bg-muted text-ai-accent rounded px-1.5 py-0.5 font-mono text-xs">
                              {event.type}
                            </code>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-ai-accent hover:bg-ai-accent/90 text-white"
            >
              {isSubmitting ? "Connecting..." : "Connect Channel"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WebhookEndpointsSectionProps {
  endpoints: WebhookEndpointWithStats[];
  eventTypes: { type: string; category: string; description: string }[];
  isPro: boolean;
  isLoadingPlan: boolean;
}

function WebhookEndpointsSection({
  endpoints,
  eventTypes,
  isPro,
  isLoadingPlan,
}: WebhookEndpointsSectionProps) {
  const [isCreating, setIsCreating] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="text-ai-accent h-5 w-5" />
            <CardTitle>Webhook Endpoints</CardTitle>
          </div>
          {isPro ? (
            <CreateWebhookDialog
              open={isCreating}
              onOpenChange={setIsCreating}
              eventTypes={eventTypes}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Professional
              </Badge>
              <Button size="sm" variant="outline" disabled>
                <Plus className="mr-1 h-4 w-4" />
                Add Endpoint
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Configure endpoints to receive webhook events
          {!isPro && !isLoadingPlan && (
            <span className="text-warning mt-1 block">Webhooks require a Professional plan.</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative">
              <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-2xl border">
                <Webhook className="text-muted-foreground h-10 w-10" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-ai-accent/20 h-32 w-32 animate-[ping_2s_ease-in-out_infinite] rounded-full border" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-ai-accent/30 h-24 w-24 animate-[ping_2s_ease-in-out_infinite_0.5s] rounded-full border" />
              </div>
            </div>
            <p className="mt-8 font-mono">Connect your first endpoint</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Receive real-time event notifications in your application
            </p>
            <Button
              onClick={() => setIsCreating(true)}
              className="bg-ai-accent hover:bg-ai-accent/90 mt-6 text-white"
              disabled={!isPro}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Endpoint
            </Button>
            {!isPro && !isLoadingPlan && (
              <p className="text-warning mt-2 text-sm">Requires a Professional plan</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map((endpoint, index) => (
              <div
                key={endpoint._id}
                style={{ animationDelay: `${index * 50}ms` }}
                className="animate-in fade-in slide-in-from-bottom-2"
              >
                <WebhookEndpointRow endpoint={endpoint} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypes: { type: string; category: string; description: string }[];
}

function CreateWebhookDialog({ open, onOpenChange, eventTypes }: CreateWebhookDialogProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const createEndpoint = useMutation(api.webhooks.mutations.createEndpoint);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    try {
      const result = await createEndpoint({
        name: name.trim(),
        url: url.trim(),
        events: selectedEvents,
        description: description.trim() || undefined,
      });

      if (result.secret) {
        setNewSecret(result.secret);
        toast.success("Webhook endpoint created");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create webhook");
    }
  };

  const handleCopySecret = async () => {
    if (newSecret) {
      await navigator.clipboard.writeText(newSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
      toast.success("Secret copied to clipboard");
    }
  };

  const handleClose = () => {
    setName("");
    setUrl("");
    setDescription("");
    setSelectedEvents([]);
    setNewSecret(null);
    setCopiedSecret(false);
    onOpenChange(false);
  };

  const toggleEvent = (eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType],
    );
  };

  const toggleCategory = (category: string) => {
    const categoryEvents = eventTypes.filter((e) => e.category === category).map((e) => e.type);

    const allSelected = categoryEvents.every((e) => selectedEvents.includes(e));

    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !categoryEvents.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...categoryEvents])]);
    }
  };

  const eventsByCategory = eventTypes.reduce(
    (acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    },
    {} as Record<string, typeof eventTypes>,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-ai-accent hover:bg-ai-accent/90 text-white">
          <Plus className="mr-1 h-4 w-4" />
          Add Endpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{newSecret ? "Webhook Created" : "Create Webhook Endpoint"}</DialogTitle>
          <DialogDescription>
            {newSecret
              ? "Copy your signing secret now. You won't be able to see it again."
              : "Configure a new endpoint to receive webhook events."}
          </DialogDescription>
        </DialogHeader>

        {newSecret ? (
          <div className="space-y-4">
            <div>
              <Label>Signing Secret</Label>
              <div className="relative mt-1.5">
                <div className="from-ai-accent/20 to-ai-accent/10 absolute -inset-1 rounded-lg bg-gradient-to-r blur" />
                <div className="bg-muted border-ai-accent/30 relative flex items-center gap-2 rounded-lg border p-3">
                  <Input
                    value={newSecret}
                    readOnly
                    className="text-ai-accent flex-1 border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy webhook secret"
                    onClick={handleCopySecret}
                    className="shrink-0"
                  >
                    {copiedSecret ? (
                      <Check className="text-success h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="border-warning/30 bg-warning-surface flex items-start gap-3 rounded-lg border p-4">
              <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-warning font-medium">Store this secret securely</p>
                <p className="text-warning text-sm">You'll need it to verify webhook signatures.</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleClose}
                className="bg-ai-accent hover:bg-ai-accent/90 text-white"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g., Production Webhook"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://example.com/webhooks/seal"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono"
              />
              <p className="text-muted-foreground text-xs">Must be HTTPS for production use</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-description">Description (optional)</Label>
              <Textarea
                id="webhook-description"
                placeholder="What this webhook is used for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Events to subscribe</Label>
                {selectedEvents.length > 0 && (
                  <Badge variant="secondary" className="text-ai-accent">
                    {selectedEvents.length} selected
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">Leave empty to receive all events</p>
              <div className="bg-muted/30 max-h-48 space-y-4 overflow-y-auto rounded-lg border p-3">
                {Object.entries(eventsByCategory).map(([category, events]) => {
                  const categorySelected = events.every((e) => selectedEvents.includes(e.type));
                  const categoryPartial =
                    !categorySelected && events.some((e) => selectedEvents.includes(e.type));

                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center gap-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={categorySelected}
                          ref={(el) => {
                            if (el) {
                              (el as HTMLButtonElement).dataset.state = categoryPartial
                                ? "indeterminate"
                                : undefined;
                            }
                          }}
                          onCheckedChange={() => toggleCategory(category)}
                          className="data-[state=checked]:border-ai-accent data-[state=checked]:bg-ai-accent"
                        />
                        <Label
                          htmlFor={`category-${category}`}
                          className="cursor-pointer font-medium"
                        >
                          {category}
                        </Label>
                      </div>
                      <div className="ml-6 space-y-1">
                        {events.map((event) => (
                          <div key={event.type} className="flex items-start gap-2">
                            <Checkbox
                              id={event.type}
                              checked={selectedEvents.includes(event.type)}
                              onCheckedChange={() => toggleEvent(event.type)}
                              className="data-[state=checked]:border-ai-accent data-[state=checked]:bg-ai-accent mt-0.5"
                            />
                            <Label
                              htmlFor={event.type}
                              className="cursor-pointer text-sm font-normal"
                            >
                              <code className="bg-muted text-ai-accent rounded px-1.5 py-0.5 font-mono text-xs">
                                {event.type}
                              </code>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-ai-accent hover:bg-ai-accent/90 text-white"
              >
                Create Endpoint
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface WebhookEndpointRowProps {
  endpoint: WebhookEndpointWithStats;
}

function WebhookEndpointRow({ endpoint }: WebhookEndpointRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const updateEndpoint = useMutation(api.webhooks.mutations.updateEndpoint);
  const deleteEndpoint = useMutation(api.webhooks.mutations.deleteEndpoint);
  const rotateSecret = useMutation(api.webhooks.mutations.rotateSecret);
  const testEndpoint = useMutation(api.webhooks.mutations.testEndpoint);

  const deliveries = useQuery(
    api.webhooks.queries.listDeliveries,
    isExpanded ? { endpointId: endpoint._id, limit: 25 } : "skip",
  );

  const handleToggleStatus = async () => {
    const newStatus = endpoint.status === "active" ? "paused" : "active";
    try {
      await updateEndpoint({
        endpointId: endpoint._id,
        status: newStatus,
      });
      toast.success(newStatus === "active" ? "Webhook enabled" : "Webhook paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update webhook");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEndpoint({ endpointId: endpoint._id });
      toast.success("Webhook deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete webhook");
    }
  };

  const handleRotateSecret = async () => {
    try {
      const result = await rotateSecret({ endpointId: endpoint._id });
      if (result.secret) {
        await navigator.clipboard.writeText(result.secret);
        toast.success("New secret copied to clipboard");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate secret");
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      await testEndpoint({ endpointId: endpoint._id });
      toast.success("Test webhook sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test");
    } finally {
      setIsTesting(false);
    }
  };

  const statusConfig = {
    active: {
      border: "border-l-ai-accent",
      badge: "text-ai-accent",
      dot: "bg-ai-accent",
    },
    paused: {
      border: "border-l-warning",
      badge: "text-warning",
      dot: "bg-warning",
    },
    disabled: {
      border: "border-l-destructive",
      badge: "text-destructive",
      dot: "bg-destructive",
    },
  };

  const config = statusConfig[endpoint.status];

  const urlParts = endpoint.url.match(/^(https?:\/\/)(.+)$/);
  const protocol = urlParts?.[1] || "";
  const urlPath = urlParts?.[2] || endpoint.url;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="group hover:border-ai-accent/30 relative overflow-hidden rounded-lg border transition-[border-color,box-shadow] duration-200 hover:shadow-sm">
        <div className={cn("absolute top-0 bottom-0 left-0 w-1", config.border)} />

        <div className="p-4 pl-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <CollapsibleTrigger className="hover:text-ai-accent flex items-center gap-2 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  )}
                  <span className="font-medium">{endpoint.name}</span>
                </CollapsibleTrigger>
                <div className={cn("h-2 w-2 rounded-full", config.dot)} />
                <Badge variant="secondary" className={config.badge}>
                  {endpoint.status}
                </Badge>
                {endpoint.format === "slack" && (
                  <Badge variant="outline" className="text-xs">
                    Slack
                  </Badge>
                )}
              </div>
              <div className="truncate font-mono text-sm">
                <span className="text-muted-foreground">{protocol}</span>
                <span>{urlPath}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-4 text-xs">
                <span
                  className={cn(
                    "font-mono font-medium",
                    endpoint.stats.successRate >= 90
                      ? "text-success"
                      : endpoint.stats.successRate >= 70
                        ? "text-warning"
                        : "text-destructive",
                  )}
                >
                  {endpoint.stats.successRate}% success
                </span>
                <span>
                  {endpoint.events.length === 0 ? "All events" : `${endpoint.events.length} events`}
                </span>
                {endpoint.lastSuccessAt && (
                  <span>Last success {formatRelativeTime(endpoint.lastSuccessAt)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting}
                title="Send test webhook"
              >
                <Send className={cn("h-4 w-4", isTesting && "motion-safe:animate-pulse")} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
                title={endpoint.status === "active" ? "Pause" : "Enable"}
              >
                {endpoint.status === "active" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this webhook endpoint and all its delivery
                      history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <Separator />
          <div className="space-y-6 p-4 pl-5">
            {endpoint.format !== "slack" && (
              <div className="space-y-2">
                <Label>Signing Secret</Label>
                <div className="flex items-center gap-2">
                  <div className="bg-muted/50 flex flex-1 items-center gap-2 rounded-lg border px-3 py-2">
                    <code
                      className={cn(
                        "font-mono text-sm transition-[filter,color] duration-300",
                        showSecret ? "text-ai-accent" : "text-muted-foreground blur-sm",
                      )}
                    >
                      {showSecret ? `${endpoint.secretPrefix}...` : "whsec_••••••••••••••••"}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={showSecret ? "Hide signing secret" : "Show signing secret"}
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        title="Rotate secret"
                        aria-label="Rotate signing secret"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Rotate Secret</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will generate a new signing secret. The old secret will be
                          invalidated immediately. Make sure to update your integration.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRotateSecret}
                          className="bg-warning hover:bg-warning/90 text-white"
                        >
                          Rotate Secret
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Subscribed Events</Label>
              <div className="flex flex-wrap gap-1.5">
                {endpoint.events.length === 0 ? (
                  <Badge variant="outline" className="text-ai-accent font-mono text-xs">
                    All events
                  </Badge>
                ) : (
                  endpoint.events.map((event) => (
                    <Badge key={event} variant="outline" className="font-mono text-xs">
                      {event}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recent Deliveries</Label>
              {deliveries === undefined ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <div className="border-muted-foreground/30 border-t-ai-accent h-4 w-4 animate-spin rounded-full border-2" />
                  Loading...
                </div>
              ) : deliveries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No deliveries yet</p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
                  {deliveries.map((delivery, index) => (
                    <DeliveryRow
                      key={delivery._id}
                      delivery={delivery}
                      isLast={index === deliveries.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface DeliveryRowProps {
  delivery: Doc<"webhook_deliveries">;
  isLast: boolean;
}

type WebhookDelivery = Doc<"webhook_deliveries">;

function deliveryStatusConfig(status: WebhookDelivery["status"]): {
  readonly bg: string;
  readonly icon: React.ReactNode;
} {
  const config = {
    pending: {
      icon: <Clock className="text-info h-4 w-4" />,
      bg: "bg-info-surface",
    },
    delivered: {
      icon: <Check className="text-success h-4 w-4" />,
      bg: "bg-success-surface",
    },
    failed: {
      icon: <XCircle className="text-destructive h-4 w-4" />,
      bg: "bg-destructive/10",
    },
    abandoned: {
      icon: <XCircle className="text-muted-foreground h-4 w-4" />,
      bg: "bg-muted",
    },
  } satisfies Record<
    WebhookDelivery["status"],
    { readonly bg: string; readonly icon: React.ReactNode }
  >;
  return config[status];
}

function responseCodeColor(responseCode: number | undefined): string {
  if (responseCode && responseCode >= 200 && responseCode < 300) return "text-success";
  return responseCode && responseCode >= 400 ? "text-destructive" : "text-warning";
}

function parsedDeliveryPayload(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function DeliveryRow({ delivery, isLast }: DeliveryRowProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const config = deliveryStatusConfig(delivery.status);

  return (
    <div className="relative flex items-start gap-3">
      {!isLast && <div className="bg-border absolute top-7 bottom-0 left-[11px] w-px" />}
      <div
        className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", config.bg)}
      >
        {config.icon}
      </div>
      <div className="flex-1">
        <DeliverySummaryButton
          delivery={delivery}
          isDetailOpen={isDetailOpen}
          setIsDetailOpen={setIsDetailOpen}
        />
        {isDetailOpen && <DeliveryDetails delivery={delivery} />}
      </div>
    </div>
  );
}

function DeliverySummaryButton({
  delivery,
  isDetailOpen,
  setIsDetailOpen,
}: {
  readonly delivery: WebhookDelivery;
  readonly isDetailOpen: boolean;
  readonly setIsDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <button
      type="button"
      onClick={() => setIsDetailOpen(!isDetailOpen)}
      className="bg-muted/30 hover:bg-muted/50 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
    >
      <div className="flex items-center gap-2">
        <code className="bg-muted text-ai-accent rounded px-1.5 py-0.5 font-mono text-xs">
          {delivery.eventType}
        </code>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        {delivery.responseCode && (
          <span className={cn("font-mono font-medium", responseCodeColor(delivery.responseCode))}>
            {delivery.responseCode}
          </span>
        )}
        {delivery.responseTimeMs && <span className="font-mono">{delivery.responseTimeMs}ms</span>}
        <span>{formatRelativeTime(delivery.createdAt)}</span>
        {isDetailOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </div>
    </button>
  );
}

function DeliveryDetails({ delivery }: { readonly delivery: WebhookDelivery }) {
  return (
    <div className="mt-2 space-y-3 rounded-lg border p-3">
      <DeliveryMetadataGrid delivery={delivery} />
      {delivery.errorMessage && (
        <DeliveryCodeBlock label="Error" tone="error" value={delivery.errorMessage} />
      )}
      {delivery.responseBody && (
        <DeliveryCodeBlock
          label="Response Body"
          maxHeightClassName="max-h-24"
          value={delivery.responseBody}
        />
      )}
      <DeliveryCodeBlock
        label="Payload"
        maxHeightClassName="max-h-48"
        value={parsedDeliveryPayload(delivery.payload)}
      />
    </div>
  );
}

function DeliveryMetadataGrid({ delivery }: { readonly delivery: WebhookDelivery }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <DeliveryMetadata
        label="Status"
        value={delivery.status}
        valueClassName="font-medium capitalize"
      />
      <DeliveryMetadata
        label="Attempts"
        value={delivery.attemptCount}
        valueClassName="font-mono font-medium"
      />
      <DeliveryMetadata
        label="Event ID"
        value={delivery.eventId}
        valueClassName="truncate font-mono"
      />
      <DeliveryMetadata label="Created" value={formatDate(delivery.createdAt)} />
      {delivery.deliveredAt && (
        <DeliveryMetadata label="Delivered" value={formatDate(delivery.deliveredAt)} />
      )}
      {delivery.nextRetryAt && (
        <DeliveryMetadata label="Next Retry" value={formatDate(delivery.nextRetryAt)} />
      )}
    </div>
  );
}

function DeliveryMetadata({
  label,
  value,
  valueClassName,
}: {
  readonly label: string;
  readonly value: number | string;
  readonly valueClassName?: string;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <div className={cn("mt-0.5", valueClassName)}>{value}</div>
    </div>
  );
}

function DeliveryCodeBlock({
  label,
  maxHeightClassName = "",
  tone = "default",
  value,
}: {
  readonly label: string;
  readonly maxHeightClassName?: string;
  readonly tone?: "default" | "error";
  readonly value: string;
}) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <pre
        className={cn(
          "mt-1 overflow-auto rounded border p-2 font-mono text-xs",
          maxHeightClassName,
          tone === "error"
            ? "bg-destructive/10 border-destructive/30 text-destructive"
            : "bg-muted",
        )}
      >
        {value}
      </pre>
    </div>
  );
}

interface EventTypesReferenceProps {
  eventTypes: { type: string; category: string; description: string }[];
}

function EventTypesReference({ eventTypes }: EventTypesReferenceProps) {
  const [isOpen, setIsOpen] = useState(false);

  const eventsByCategory = eventTypes.reduce(
    (acc, event) => {
      if (!acc[event.category]) {
        acc[event.category] = [];
      }
      acc[event.category].push(event);
      return acc;
    },
    {} as Record<string, typeof eventTypes>,
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="text-ai-accent h-5 w-5" />
                <div>
                  <CardTitle className="text-base">Event Types Reference</CardTitle>
                  <CardDescription>All available webhook event types</CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="text-muted-foreground h-5 w-5" />
              ) : (
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-6">
              {Object.entries(eventsByCategory).map(([category, events]) => (
                <div key={category}>
                  <h4 className="mb-3 font-medium">{category}</h4>
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.type}
                        className="bg-muted/30 flex items-start justify-between gap-4 rounded-lg border px-3 py-2"
                      >
                        <code className="bg-muted text-ai-accent shrink-0 rounded px-1.5 py-0.5 font-mono text-xs">
                          {event.type}
                        </code>
                        <span className="text-muted-foreground text-right text-sm">
                          {event.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function WebhookDocumentation() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ExternalLink className="text-ai-accent h-5 w-5" />
          <CardTitle>Webhook Documentation</CardTitle>
        </div>
        <CardDescription>Learn how to verify and handle webhook events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted relative overflow-hidden rounded-lg border">
          <div className="bg-muted/50 flex items-center gap-2 border-b px-4 py-2">
            <div className="bg-destructive/80 h-3 w-3 rounded-full" />
            <div className="bg-warning/80 h-3 w-3 rounded-full" />
            <div className="bg-success/80 h-3 w-3 rounded-full" />
            <span className="text-muted-foreground ml-2 font-mono text-xs">
              verify-signature.js
            </span>
          </div>
          <div className="p-4">
            <pre className="overflow-x-auto font-mono text-sm">
              <code>
                <span className="text-ai-accent">const</span>
                <span> crypto = </span>
                <span className="text-info">require</span>
                <span>(</span>
                <span className="text-success">'crypto'</span>
                <span>);</span>
                {"\n\n"}
                <span className="text-ai-accent">function</span>
                <span className="text-info"> verifyWebhook</span>
                <span>(payload, signature, timestamp, secret) {"{"}</span>
                {"\n"}
                <span>{"  "}</span>
                <span className="text-ai-accent">const</span>
                <span>
                  {" "}
                  signedPayload = `${"{"}timestamp{"}"}.${"{"}payload{"}"}`
                </span>
                <span>;</span>
                {"\n"}
                <span>{"  "}</span>
                <span className="text-ai-accent">const</span>
                <span> expected = crypto</span>
                {"\n"}
                <span>{"    "}.createHmac(</span>
                <span className="text-success">'sha256'</span>
                <span>, secret)</span>
                {"\n"}
                <span>{"    "}.update(signedPayload)</span>
                {"\n"}
                <span>{"    "}.digest(</span>
                <span className="text-success">'hex'</span>
                <span>);</span>
                {"\n"}
                <span>{"  "}</span>
                <span className="text-ai-accent">return</span>
                <span> crypto.timingSafeEqual(</span>
                {"\n"}
                <span>{"    "}Buffer.from(signature),</span>
                {"\n"}
                <span>{"    "}Buffer.from(expected)</span>
                {"\n"}
                <span>{"  "});</span>
                {"\n"}
                <span>{"}"}</span>
              </code>
            </pre>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg border p-4">
          <h4 className="mb-3 font-medium">Webhook Headers</h4>
          <div className="space-y-2 text-sm">
            {[
              ["X-Seal-Signature", "HMAC-SHA256 signature"],
              ["X-Seal-Timestamp", "Unix timestamp of request"],
              ["X-Seal-Event-Id", "Unique event identifier"],
              ["X-Seal-Event-Type", "Event type name"],
            ].map(([header, description]) => (
              <div key={header} className="flex items-center justify-between gap-4">
                <code className="bg-muted text-ai-accent rounded px-1.5 py-0.5 font-mono text-xs">
                  {header}
                </code>
                <span className="text-muted-foreground">{description}</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="outline" asChild>
          <a href="/docs/webhooks" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Full Documentation
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
