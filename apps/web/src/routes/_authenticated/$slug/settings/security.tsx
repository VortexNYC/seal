import { Banner } from "@cloudflare/kumo/components/banner";
import { Text } from "@cloudflare/kumo/components/text";
/**
 * Security Settings Page
 *
 * API access, IP allowlist, and ownership transfer. The form is shared.
 * Seal enforces the allowlist. Org MFA and session timeout are on General.
 *
 * Product document audit → audit-log.
 * Route: /{slug}/settings/security
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AuthProvider,
  isOrganizationAdminRole,
  OrganizationAccessForm,
  useAuth,
} from "@vortex-api/better-auth-ui";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton, PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getSecuritySettings, updateSecuritySettings } from "@/lib/api-client";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/settings/security")(
  {
    component: SecuritySettings,
    pendingComponent: () => <PageFormSkeleton title="Security Settings" />,
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

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const ipAllowlist = formData.ipAllowlistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      await updateSecuritySettings(slug, {
        ipAllowlist,
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
      <SettingsBody>
        <OrganizationAccessForm
          value={{
            allowApiAccess: formData.allowApiAccess,
            ssoEnforced: formData.ssoEnforced,
            ipAllowlist: formData.ipAllowlistText,
            delegateOwnership,
          }}
          canEdit={isOwner}
          canEditOwnership={isAdmin}
          pending={isSubmitting}
          ownershipPending={isDelegateOwnershipUpdating}
          notice={
            <>
              {!isOwner ? (
                <Banner
                  variant="alert"
                  size="sm"
                  description="Only workspace owners can change these settings."
                />
              ) : null}
              <Text as="p" variant="secondary" size="sm">
                Personal 2FA is under{" "}
                <Link
                  className="text-kumo-default underline-offset-4 hover:underline"
                  params={{ slug }}
                  to="/$slug/settings/profile/security"
                >
                  Account → Security
                </Link>
                . Document activity is in the{" "}
                <Link
                  className="text-kumo-default underline-offset-4 hover:underline"
                  params={{ slug }}
                  to="/$slug/settings/audit-log"
                >
                  audit log
                </Link>
                .
              </Text>
            </>
          }
          onChange={(next) => {
            setFormData({
              allowApiAccess: next.allowApiAccess,
              ssoEnforced: next.ssoEnforced,
              ipAllowlistText: next.ipAllowlist,
            });
          }}
          onDelegateOwnershipChange={(checked) => {
            void handleDelegateOwnershipChange(checked);
          }}
          onSubmit={() => {
            void handleSubmit();
          }}
        />
      </SettingsBody>
    </PageWrapper>
  );
}
