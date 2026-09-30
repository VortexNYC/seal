/**
 * Developer Settings - Webhooks
 * Route: /{slug}/settings/developer/webhooks
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { isOrganizationAdminRole } from "@vortex-api/better-auth-ui";

import { PageWrapper } from "@/components/page-wrapper";
import { DeveloperNav } from "@/components/settings/developer-nav";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import {
  createWebhook,
  deleteWebhook,
  getWebhookEventTypes,
  getWebhooks,
  type CreatedWebhook,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/webhooks"
)({
  component: WebhooksPage,
  pendingComponent: FormSkeleton,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function WebhooksPage() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);
  const queryClient = useQueryClient();

  const {
    data: endpoints,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["webhooks", slug],
    queryFn: () => getWebhooks(slug),
  });

  const { data: eventTypes } = useQuery({
    queryKey: ["webhook-event-types", slug],
    queryFn: () => getWebhookEventTypes(slug),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([
    "document.completed",
    "document.sent",
  ]);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  const createMutation = useMutation({
    mutationFn: (input: { name: string; url: string; events: string[] }) =>
      createWebhook(slug, input),
    onSuccess: (data) => {
      setCreated(data);
      setName("");
      setUrl("");
      setEvents(["document.completed", "document.sent"]);
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["webhooks", slug] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create webhook"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(slug, webhookId),
    onSuccess: () => {
      toast.success("Webhook deleted");
      void queryClient.invalidateQueries({ queryKey: ["webhooks", slug] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete webhook"
      );
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || events.length === 0) return;
    createMutation.mutate({
      name: name.trim(),
      url: url.trim(),
      events,
    });
  };

  const toggleEvent = (event: string, checked: boolean | "indeterminate") => {
    const active = checked === true;
    setEvents((prev) =>
      active ? [...new Set([...prev, event])] : prev.filter((e) => e !== event)
    );
  };

  return (
    <PageWrapper
      description="Receive HTTPS events when documents move."
      title="Developer"
    >
      <SettingsBody wide>
        <DeveloperNav slug={slug} active="webhooks" />
        <SettingsSection
          title="Endpoints"
          description="Workspace-scoped HTTPS callbacks. The signing secret is shown once at create time."
        >
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={!isAdmin}
              variant="primary"
            >
              Add endpoint
            </Button>
          </div>
          {isPending ? (
            <FormSkeleton />
          ) : isError ? (
            <Empty
              title="Could not load webhooks"
              description={
                error instanceof Error
                  ? error.message
                  : "Try again in a moment."
              }
            />
          ) : endpoints && endpoints.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>URL</Table.Head>
                  <Table.Head>Events</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head className="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {endpoints.map((endpoint) => (
                  <Table.Row key={endpoint.id}>
                    <Table.Cell>
                      <span className="font-medium">{endpoint.name}</span>
                      <Text variant="secondary" size="sm" as="p">
                        {endpoint.secret_prefix}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="max-w-[14rem] truncate text-sm">
                        {endpoint.url}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm">
                        {endpoint.events.length} event
                        {endpoint.events.length !== 1 ? "s" : ""}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm capitalize">
                        {endpoint.status}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{formatDate(endpoint.created_at)}</Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        disabled={!isAdmin}
                        onClick={() => deleteMutation.mutate(endpoint.id)}
                        size="sm"
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Empty
              title="No webhook endpoints"
              description="Add an HTTPS URL to receive document and recipient events."
            />
          )}
        </SettingsSection>
      </SettingsBody>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Add webhook endpoint</Dialog.Title>
          <Dialog.Description>
            Seal will POST signed JSON events to this URL.
          </Dialog.Description>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <Input
              id="webhook-name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production webhook"
              aria-label="Webhook name"
              required
            />
            <Input
              id="webhook-url"
              label="URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/seal"
              aria-label="Webhook URL"
              required
            />
            <div className="space-y-2">
              <Text as="span" variant="secondary" size="sm">
                Events
              </Text>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {(eventTypes ?? []).map((eventType) => (
                  <Checkbox
                    key={eventType.type}
                    label={eventType.type}
                    checked={events.includes(eventType.type)}
                    onCheckedChange={(checked) =>
                      toggleEvent(eventType.type, checked)
                    }
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row">
              <Button
                type="button"
                onClick={() => setCreateOpen(false)}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  !name.trim() || !url.trim() || events.length === 0
                }
              >
                Create
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root
        open={created !== null}
        onOpenChange={() => setCreated(null)}
      >
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Webhook created</Dialog.Title>
          <Dialog.Description>
            Copy the signing secret now. It will not be shown again.
          </Dialog.Description>
          <div className="mt-4 flex flex-col gap-3">
            <ClipboardText
              size="base"
              text={created?.secret ?? ""}
              tooltip={{
                text: "Copy signing secret",
                copiedText: "Copied!",
                side: "top",
              }}
            />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setCreated(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </PageWrapper>
  );
}
