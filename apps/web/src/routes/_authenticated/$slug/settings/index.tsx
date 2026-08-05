/**
 * General Settings Page
 *
 * Core VortexOrganizationProfile for tenant identity (name / slug / logo /
 * brand colors / email from / org MFA + session timeout).
 * Seal-specific workspace defaults (timezone, currency) remain below.
 * Route: /{slug}/settings
 *
 * @validation VAL-REAL-1776629332274
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexOrganizationProfile,
  type VortexOrgProfileOrganization,
} from "@vortexnyc/auth/react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@vortexnyc/ui";
import { useMutation, useQuery } from "convex/react";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
  component: GeneralSettings,
  pendingComponent: FormSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.settings.title },
      { name: "description", content: pageSEO.settings.description },
    ],
  }),
});

function GeneralSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const updateWorkspace = useMutation(
    api.organizations.mutations.updateWorkspace
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    timezone: "UTC",
    currency: "BRL",
    currencyKind: "normal",
  });

  const profileOrganization = useMemo<VortexOrgProfileOrganization | null>(() => {
    if (!organization) {
      return null;
    }
    const status =
      organization.status === "suspended" || organization.status === "deleted"
        ? organization.status
        : "active";
    const brand = organization.suiteBrand ?? {
      ...(organization.brandingSettings?.brandColor
        ? { primaryColor: organization.brandingSettings.brandColor }
        : {}),
      ...(organization.brandingSettings?.accentColor
        ? { accentColor: organization.brandingSettings.accentColor }
        : {}),
      ...(organization.brandingSettings?.emailFromName
        ? { emailFromName: organization.brandingSettings.emailFromName }
        : {}),
      ...(organization.brandingSettings?.emailReplyTo
        ? { emailReplyTo: organization.brandingSettings.emailReplyTo }
        : {}),
      ...(organization.brandingSettings?.companyWebsite
        ? { website: organization.brandingSettings.companyWebsite }
        : {}),
    };
    return {
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.logo ?? organization.brandingSettings?.logoUrl,
      status,
      brand,
      security: organization.suiteSecurity,
    };
  }, [organization]);

  const isAdmin =
    organization?.userRole === "owner" || organization?.userRole === "admin";

  useEffect(() => {
    if (organization) {
      setFormData({
        timezone: organization.timezone || "UTC",
        currency: organization.currency || "BRL",
        currencyKind: organization.currencyKind || "normal",
      });
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      await updateWorkspace({
        timezone: formData.timezone,
        currency: formData.currency,
        currencyKind: formData.currencyKind,
      });

      toast.success("Workspace settings updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update workspace settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper title="General Settings">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <VortexOrganizationProfile
            isAdmin={isAdmin}
            isLoading={organization === undefined}
            onUpdate={async (input) => {
              try {
                await updateWorkspace({
                  ...(input.name !== undefined ? { name: input.name } : {}),
                  ...(input.imageUrl !== undefined
                    ? { logo: input.imageUrl ?? undefined }
                    : {}),
                  ...(input.brand !== undefined ? { brand: input.brand } : {}),
                  ...(input.security !== undefined
                    ? { security: input.security }
                    : {}),
                });
                toast.success("Workspace profile updated");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to update workspace profile"
                );
              }
            }}
            organization={profileOrganization}
            copy={{
              title: "Workspace profile",
              description:
                "Suite tenant identity, brand, and org security (Core). Signing chrome stays under Branding.",
              slugLabel: "Workspace slug",
            }}
          />
        </div>

        <form onSubmit={handleSubmit} className="contents">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Regional defaults</CardTitle>
              <CardDescription>
                Seal product defaults for documents and payments in this
                workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  type="text"
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  placeholder="UTC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  type="text"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  placeholder="USD"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={isSubmitting || !isAdmin}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save regional defaults"}
            </Button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}
