import { Textarea } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowsLeftRight, FloppyDisk, Shield } from "@phosphor-icons/react";
/**
 * Security Settings Page
 *
 * Seal-owned: API access, IP allowlist (enforced in api/context.ts), document
 * ownership transfer. Org MFA + session timeout are Core (VOR-183 / SEA-604).
 *
 * Product document audit → audit-log.
 * Route: /{slug}/settings/security
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@vortex-api/better-auth-ui";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getSecuritySettings, updateSecuritySettings } from "@/lib/api-client";
import { betterAuthClient } from "@/lib/better-auth";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/settings/security")(
  {
    component: SecuritySettings,
    pendingComponent: FormSkeleton,
  }
);

interface SecurityFormData {
  ipAllowlistText: string;
  allowApiAccess: boolean;
}

function SecuritySettings() {
  const client = betterAuthClient;

  if (client === null) {
    return (
      <PageWrapper title="Security Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <AuthProvider client={client}>
      <SecuritySettingsContent />
    </AuthProvider>
  );
}

function SecuritySettingsContent() {
  const { slug } = Route.useParams();
  const client = useAuth();
  const { data: organization } = useOrganization(slug);

  const { data: securitySettings } = useQuery({
    queryKey: ["security", slug],
    queryFn: () => getSecuritySettings(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegateOwnershipUpdating, setIsDelegateOwnershipUpdating] =
    useState(false);
  const [delegateOwnership, setDelegateOwnership] = useState(false);
  const [formData, setFormData] = useState<SecurityFormData>({
    ipAllowlistText: "",
    allowApiAccess: true,
  });

  const userRole = organization?.userRole;
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || userRole === "owner";

  useEffect(() => {
    if (securitySettings) {
      setFormData({
        ipAllowlistText: securitySettings.ipAllowlist?.join("\n") ?? "",
        allowApiAccess: securitySettings.allowApiAccess,
      });
    }
  }, [securitySettings]);

  useEffect(() => {
    setDelegateOwnership(organization?.delegateOwnership ?? false);
  }, [organization]);

  const handleDelegateOwnershipChange = async (checked: boolean) => {
    if (
      client.organization?.update === undefined ||
      organization?.id === undefined
    ) {
      toast.error("Organization update is not available.");
      return;
    }

    setIsDelegateOwnershipUpdating(true);
    try {
      setDelegateOwnership(checked);

      const existingMetadata = organization.metadata ?? {};

      const response = await client.organization.update({
        organizationId: organization.id,
        data: {
          metadata: {
            ...existingMetadata,
            delegateOwnership: checked,
          },
        },
      });

      if (response.error !== null) {
        throw new Error(
          response.error.message ?? "Could not update ownership transfer."
        );
      }

      toast.success(
        checked ? "Ownership transfer enabled" : "Ownership transfer disabled"
      );
    } catch (error) {
      setDelegateOwnership(!checked);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update ownership transfer setting"
      );
    } finally {
      setIsDelegateOwnershipUpdating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ipAllowlist = formData.ipAllowlistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      await updateSecuritySettings(slug, {
        ipAllowlist: ipAllowlist.length > 0 ? ipAllowlist : undefined,
        allowApiAccess: formData.allowApiAccess,
      });
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update security settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !securitySettings) {
    return null;
  }

  return (
    <PageWrapper title="Security Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {!isOwner && (
          <div className="border-warning/30 bg-warning-surface rounded-lg border p-4 md:col-span-2">
            <p className="text-warning text-sm">
              Security settings can only be modified by organization owners.
              Contact your organization owner to make changes.
            </p>
          </div>
        )}

        <LayerCard className="border-dashed md:col-span-2">
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Suite vs Sign
            </Text>
            <Text variant="secondary" size="sm">
              Org-wide MFA and session timeout are set on{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                params={{ slug }}
                to="/$slug/settings"
              >
                General → Workspace profile
              </Link>{" "}
              (Core Auth) and enforced on org switch / authenticated requests.
              Personal 2FA stays under{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                params={{ slug }}
                to="/$slug/settings/profile/security"
              >
                Profile → Security
              </Link>
              . This page keeps Seal API access, IP allowlist, and document
              ownership transfer.
            </Text>
          </LayerCard.Secondary>
        </LayerCard>

        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <Text as="h2" variant="heading">
                API Access
              </Text>
            </div>
            <Text variant="secondary" size="sm">
              Control programmatic access to your workspace via the REST API
              (enforced in API auth).
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Checkbox
              label="Allow API access"
              checked={formData.allowApiAccess}
              disabled={!isOwner}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, allowApiAccess: checked })
              }
            />
            <Text variant="secondary" size="sm">
              Enable programmatic access via API keys. Disabling revokes all
              existing API key access.
            </Text>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              IP Allowlist
            </Text>
            <Text variant="secondary" size="sm">
              Restrict API access to specific IP addresses or CIDR ranges. Leave
              empty for no restriction.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Label htmlFor="ip-allowlist">Allowed CIDR ranges</Label>
            <Textarea
              id="ip-allowlist"
              value={formData.ipAllowlistText}
              disabled={!isOwner}
              onChange={(e) =>
                setFormData({ ...formData, ipAllowlistText: e.target.value })
              }
              placeholder={"192.168.1.0/24\n10.0.0.0/8"}
              rows={4}
            />
            <Text variant="secondary" size="sm">
              One CIDR range per line
            </Text>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <ArrowsLeftRight className="size-5" />
              <Text as="h2" variant="heading">
                Document Ownership Transfer
              </Text>
            </div>
            <Text variant="secondary" size="sm">
              Seal product setting: allow document owners to transfer ownership
              to other organization members.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Checkbox
              label="Enable ownership transfer"
              checked={delegateOwnership}
              disabled={!isAdmin || isDelegateOwnershipUpdating}
              onCheckedChange={(checked) =>
                void handleDelegateOwnershipChange(checked)
              }
            />
            <Text variant="secondary" size="sm">
              When enabled, document owners and admins can reassign document
              ownership to any organization member.
            </Text>
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isOwner}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>

      {isAdmin ? (
        <LayerCard className="mt-6">
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Access &amp; security events
            </Text>
            <Text variant="secondary" size="sm">
              Member, organization, and login events are managed in Vortex Auth.
              For document and signing activity, use the{" "}
              <Link
                className="underline underline-offset-4"
                params={{ slug }}
                to="/$slug/settings/audit-log"
              >
                Audit log
              </Link>
              .
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Text variant="secondary" size="sm">
              Security audit history is not available in this workspace view.
            </Text>
          </LayerCard.Primary>
        </LayerCard>
      ) : null}
    </PageWrapper>
  );
}
