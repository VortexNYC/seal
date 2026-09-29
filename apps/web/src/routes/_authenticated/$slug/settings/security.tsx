import { Textarea } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Label } from "@cloudflare/kumo/components/label";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowsLeftRight, FloppyDisk, Shield } from "@phosphor-icons/react";
/**
 * Security Settings Page
 *
 * Seal-owned: API access, IP allowlist (enforced in api/context.ts), document
 * ownership transfer. Org MFA + session timeout live on workspace General /
 * Account Security.
 *
 * Product document audit → audit-log.
 * Route: /{slug}/settings/security
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AuthProvider,
  isOrganizationAdminRole,
  useAuth,
} from "@vortex-api/better-auth-ui";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getSecuritySettings, updateSecuritySettings } from "@/lib/api-client";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
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
  ssoEnforced: boolean;
}

function SecuritySettings() {
  const client = getBetterAuthUiClient();

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

  const { data: securitySettings, isPending: securityPending } = useQuery({
    queryKey: ["security", slug],
    queryFn: () => getSecuritySettings(slug),
    staleTime: 60_000,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegateOwnershipUpdating, setIsDelegateOwnershipUpdating] =
    useState(false);
  const [delegateOwnership, setDelegateOwnership] = useState(false);
  const [formData, setFormData] = useState<SecurityFormData>({
    ipAllowlistText: "",
    allowApiAccess: true,
    ssoEnforced: false,
  });

  const userRole = organization?.userRole;
  const isOwner = userRole === "owner";
  const isAdmin = isOrganizationAdminRole(userRole);

  useEffect(() => {
    if (securitySettings) {
      setFormData({
        ipAllowlistText: securitySettings.ipAllowlist?.join("\n") ?? "",
        allowApiAccess: securitySettings.allowApiAccess,
        ssoEnforced: securitySettings.ssoEnforced ?? false,
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
        ssoEnforced: formData.ssoEnforced,
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

  if (organization === undefined || securityPending || !securitySettings) {
    return (
      <PageWrapper title="Security Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Security Settings">
      <SettingsBody wide>
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-2">
        {!isOwner && (
          <div className="border-warning/30 bg-warning-surface rounded-lg border p-4 lg:col-span-2">
            <p className="text-warning text-sm">
              Only workspace owners can change these settings.
            </p>
          </div>
        )}

        <p className="text-muted-foreground text-sm lg:col-span-2">
          Personal 2FA is under{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            params={{ slug }}
            to="/$slug/settings/profile/security"
          >
            Account → Security
          </Link>
          . Document activity is in the{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            params={{ slug }}
            to="/$slug/settings/audit-log"
          >
            audit log
          </Link>
          .
        </p>

        <SettingsSection
          className="lg:col-span-2"
          icon={<Shield className="size-4" />}
          title="API access"
          description="Programmatic access via API keys and SSO."
        >
          <Checkbox
            label="Allow API access"
            checked={formData.allowApiAccess}
            disabled={!isOwner}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, allowApiAccess: checked })
            }
          />
          <Checkbox
            label="Require company SSO"
            checked={formData.ssoEnforced}
            disabled={!isOwner}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, ssoEnforced: checked })
            }
          />
          <Text variant="secondary" size="sm">
            SSO needs an IdP registered via the SSO API first. Owners can always
            turn this off.
          </Text>
        </SettingsSection>

        <SettingsSection
          title="IP allowlist"
          description="Restrict API access. One CIDR per line; empty = no limit."
        >
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
        </SettingsSection>

        <SettingsSection
          icon={<ArrowsLeftRight className="size-4" />}
          title="Ownership transfer"
          description="Let owners reassign documents to other members."
        >
          <Checkbox
            label="Enable ownership transfer"
            checked={delegateOwnership}
            disabled={!isAdmin || isDelegateOwnershipUpdating}
            onCheckedChange={(checked) =>
              void handleDelegateOwnershipChange(checked)
            }
          />
        </SettingsSection>

        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isOwner}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      </SettingsBody>
    </PageWrapper>
  );
}
