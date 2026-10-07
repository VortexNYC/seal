/**
 * Developer Settings - API Keys
 *
 * Route: /{slug}/settings/developer/api-keys
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
import { isOrganizationAdminRole } from "@vortex-api/better-auth-ui";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { DeveloperNav } from "@/components/settings/developer-nav";
import { FormSkeleton, PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import {
  createApiToken,
  getApiTokens,
  revokeApiToken,
  type CreatedApiToken,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

const API_TOKEN_SCOPES = ["read", "write", "sign", "admin"] as const;

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/api-keys"
)({
  component: ApiKeysPage,
  pendingComponent: () => <PageFormSkeleton title="Developer" />,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function ApiKeysPage() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);
  const queryClient = useQueryClient();

  const { data: tokens, isPending } = useQuery({
    queryKey: ["api-tokens", slug],
    queryFn: () => getApiTokens(slug),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(
    null
  );

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  const createMutation = useMutation({
    mutationFn: (input: { name: string; scopes: string[] }) =>
      createApiToken(slug, input),
    onSuccess: (data) => {
      setCreatedToken(data);
      setName("");
      setScopes(["read"]);
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["api-tokens", slug] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to create API token"
      );
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => revokeApiToken(slug, tokenId),
    onSuccess: () => {
      toast.success("API token revoked");
      void queryClient.invalidateQueries({ queryKey: ["api-tokens", slug] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to revoke API token"
      );
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    createMutation.mutate({ name: name.trim(), scopes });
  };

  const toggleScope = (scope: string, checked: boolean | "indeterminate") => {
    const active = checked === true;
    setScopes((prev) =>
      active ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope)
    );
  };

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
          <div className="flex justify-end">
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={!isAdmin}
              variant="primary"
            >
              Create API key
            </Button>
          </div>
          {isPending ? (
            <FormSkeleton />
          ) : tokens && tokens.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Name</Table.Head>
                  <Table.Head>Public ID</Table.Head>
                  <Table.Head>Scopes</Table.Head>
                  <Table.Head>Created</Table.Head>
                  <Table.Head>Last used</Table.Head>
                  <Table.Head className="text-right">Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tokens.map((token) => (
                  <Table.Row
                    key={token.id}
                    className={token.revokedAt ? "opacity-50" : ""}
                  >
                    <Table.Cell>
                      <span className="font-medium">{token.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Text variant="secondary" size="sm">
                        {token.publicId}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm">{token.scopes.join(", ")}</span>
                    </Table.Cell>
                    <Table.Cell>{formatDate(token.createdAt)}</Table.Cell>
                    <Table.Cell>{formatDate(token.lastUsedAt)}</Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        disabled={!isAdmin || !!token.revokedAt}
                        onClick={() => revokeMutation.mutate(token.id)}
                        size="sm"
                        variant="destructive"
                      >
                        Revoke
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Empty
              title="No API keys"
              description="Create an API key to get started."
            />
          )}
        </SettingsSection>
      </SettingsBody>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Create API key</Dialog.Title>
          <Dialog.Description>
            Name the key and select the scopes it may use.
          </Dialog.Description>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Input
                id="token-name"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production CI"
                aria-label="Token name"
                required
              />
            </div>
            <div className="space-y-2">
              <Text as="span" variant="secondary" size="sm">
                Scopes
              </Text>
              <div className="space-y-2">
                {API_TOKEN_SCOPES.map((scope) => (
                  <Checkbox
                    key={scope}
                    label={scope}
                    checked={scopes.includes(scope)}
                    onCheckedChange={(checked) => toggleScope(scope, checked)}
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
                disabled={!name.trim() || scopes.length === 0}
              >
                Create
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root
        open={createdToken !== null}
        onOpenChange={() => setCreatedToken(null)}
      >
        <Dialog size="sm" className="p-6">
          <Dialog.Title>API key created</Dialog.Title>
          <Dialog.Description>
            Copy the token now. It will not be shown again.
          </Dialog.Description>
          <div className="mt-4 flex flex-col gap-4">
            <ClipboardText
              size="base"
              text={createdToken?.token ?? ""}
              tooltip={{
                text: "Copy token",
                copiedText: "Copied!",
                side: "top",
              }}
            />
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button onClick={() => setCreatedToken(null)} variant="ghost">
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      </Dialog.Root>
    </PageWrapper>
  );
}
