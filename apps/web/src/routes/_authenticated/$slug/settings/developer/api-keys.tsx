/**
 * Developer Settings - API Keys
 *
 * Route: /{slug}/settings/developer/api-keys
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ApiKeyManager,
  isOrganizationAdminRole,
} from "@vortex-api/better-auth-ui";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { DeveloperNav } from "@/components/settings/developer-nav";
import { PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { createApiToken, getApiTokens, revokeApiToken } from "@/lib/api-client";
import { toast } from "@/lib/toast";

const API_TOKEN_SCOPES = ["read", "write", "sign", "admin"] as const;

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/api-keys"
)({
  component: ApiKeysPage,
  pendingComponent: () => <PageFormSkeleton title="Developer" />,
});

function ApiKeysPage() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);
  const queryClient = useQueryClient();

  const { data: tokens, isPending } = useQuery({
    queryKey: ["api-tokens", slug],
    queryFn: () => getApiTokens(slug),
  });

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      scopes: string[];
      allowedIpRanges: string[];
    }) => createApiToken(slug, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-tokens", slug] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => revokeApiToken(slug, tokenId),
    onSuccess: () => {
      toast.success("API token revoked");
      void queryClient.invalidateQueries({ queryKey: ["api-tokens", slug] });
    },
  });

  return (
    <PageWrapper
      description="Programmatic access to the Seal API"
      title="Developer"
    >
      <SettingsBody>
        <DeveloperNav slug={slug} active="api-keys" />
        <SettingsSection
          title="API keys"
          description="Workspace-scoped tokens for the Seal REST API. The plaintext secret is shown once."
        >
          <ApiKeyManager
            keys={(tokens ?? []).map((token) => ({
              id: token.id,
              name: token.name,
              publicId: token.publicId,
              scopes: token.scopes,
              allowedIpRanges: token.allowedIpRanges,
              createdAt: token.createdAt,
              lastUsedAt: token.lastUsedAt,
              revokedAt: token.revokedAt,
            }))}
            scopeOptions={API_TOKEN_SCOPES}
            canManage={isAdmin}
            isLoading={isPending}
            onCreate={async (input) => {
              const created = await createMutation.mutateAsync(input);
              return { name: created.name, secret: created.token };
            }}
            onRevoke={async (id) => {
              await revokeMutation.mutateAsync(id);
            }}
          />
        </SettingsSection>
      </SettingsBody>
    </PageWrapper>
  );
}
