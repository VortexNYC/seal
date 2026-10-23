/**
 * Developer Settings - Webhooks
 * Route: /{slug}/settings/developer/webhooks
 */

import { Empty } from "@cloudflare/kumo/components/empty";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  isOrganizationAdminRole,
  WebhookManager,
} from "@vortex-api/better-auth-ui";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { DeveloperNav } from "@/components/settings/developer-nav";
import { FormSkeleton, PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import {
  createWebhook,
  deleteWebhook,
  getWebhookEventTypes,
  getWebhooks,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/webhooks"
)({
  component: WebhooksPage,
  pendingComponent: () => <PageFormSkeleton title="Developer" />,
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

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  const createMutation = useMutation({
    mutationFn: (input: { name: string; url: string; events: string[] }) =>
      createWebhook(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["webhooks", slug] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(slug, webhookId),
    onSuccess: () => {
      toast.success("Webhook deleted");
      void queryClient.invalidateQueries({ queryKey: ["webhooks", slug] });
    },
  });

  return (
    <PageWrapper
      description="Receive HTTPS events when documents move."
      title="Developer"
    >
      <SettingsBody>
        <DeveloperNav slug={slug} active="webhooks" />
        <SettingsSection
          title="Endpoints"
          description="Workspace-scoped HTTPS callbacks. The signing secret is shown once at create time."
        >
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
          ) : (
            <WebhookManager
              endpoints={(endpoints ?? []).map((endpoint) => ({
                id: endpoint.id,
                name: endpoint.name,
                url: endpoint.url,
                events: endpoint.events,
                status: endpoint.status,
                secretPrefix: endpoint.secret_prefix,
                createdAt: formatDate(endpoint.created_at),
              }))}
              deliveries={[]}
              showDeliveries={false}
              eventOptions={(eventTypes ?? []).map(
                (eventType) => eventType.type
              )}
              canManage={isAdmin}
              onCreate={async (input) => {
                const created = await createMutation.mutateAsync(input);
                return { secret: created.secret };
              }}
              onDelete={async (id) => {
                await deleteMutation.mutateAsync(id);
              }}
            />
          )}
        </SettingsSection>
      </SettingsBody>
    </PageWrapper>
  );
}
