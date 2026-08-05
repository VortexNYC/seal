/**
 * Signing chrome settings (SEA-603)
 *
 * Sign-only white-label controls. Suite tenant identity (name / slug / logo /
 * colors / email from) lives on General via Core VortexOrganizationProfile
 * (VOR-182). This page keeps hideSealBranding + custom signing footer.
 *
 * Route: /{slug}/settings/branding
 * Gating: Pro Sign SKU (`PLAN_LIMITS.*.branding`) — not a separate suite SKU.
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@vortexnyc/ui";
import { useMutation, useQuery } from "convex/react";
import { PaletteIcon, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/$slug/settings/branding")(
  {
    component: BrandingSettings,
    pendingComponent: FormSkeleton,
  }
);

function BrandingSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const brandingSettings = useQuery(
    api.organizations.queries.getBrandingSettings,
    organization ? { organizationId: organization._id } : "skip"
  );

  const updateBranding = useMutation(
    api.organizations.mutations.updateBrandingSettings
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    enabled: false,
    hideSealBranding: false,
    customFooterText: "",
  });

  useEffect(() => {
    if (brandingSettings) {
      setFormData({
        enabled: brandingSettings.enabled,
        hideSealBranding: brandingSettings.hideSealBranding ?? false,
        customFooterText: brandingSettings.customFooterText ?? "",
      });
    }
  }, [brandingSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateBranding({
        enabled: formData.enabled,
        hideSealBranding: formData.hideSealBranding,
        customFooterText: formData.customFooterText || undefined,
      });
      toast.success("Signing chrome updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update signing chrome"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !brandingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Signing chrome">
      <FeatureGate
        tier="pro"
        feature="Signing chrome (Pro)"
        description="White-label the Seal signing page footer. Workspace brand colors and email from live under General (Core org profile)."
      >
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <Card className="md:col-span-2 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Suite vs Sign</CardTitle>
              <CardDescription>
                Tenant identity, colors, and email from belong on{" "}
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{ slug }}
                  to="/$slug/settings"
                >
                  General → Workspace profile
                </Link>
                . This page is Sign-only chrome gated by the Pro Sign SKU.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PaletteIcon className="h-5 w-5" />
                <CardTitle>Enable signing chrome</CardTitle>
              </div>
              <CardDescription>
                When on, recipients see suite brand (from General) plus the
                footer controls below on the signing page and in document
                emails.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="branding-enabled"
                    className="text-sm font-medium"
                  >
                    Apply custom signing chrome
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Free workspaces keep Seal defaults (`PLAN_LIMITS.free.branding
                    = false`).
                  </p>
                </div>
                <Switch
                  id="branding-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Signing footer (Seal)</CardTitle>
              <CardDescription>
                Product-owned chrome — stays on Seal after Core tenant brand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="hide-seal-branding"
                    className="text-sm font-medium"
                  >
                    Hide &quot;Powered by Seal&quot;
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Remove the Seal branding footer from signing pages.
                  </p>
                </div>
                <Switch
                  id="hide-seal-branding"
                  checked={formData.hideSealBranding}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, hideSealBranding: checked })
                  }
                />
              </div>
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="custom-footer" className="text-sm">
                  Custom footer text
                </Label>
                <Input
                  id="custom-footer"
                  placeholder="e.g. Acme Corp — Confidential"
                  value={formData.customFooterText}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customFooterText: e.target.value,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save signing chrome"}
            </Button>
          </div>
        </form>
      </FeatureGate>
    </PageWrapper>
  );
}
