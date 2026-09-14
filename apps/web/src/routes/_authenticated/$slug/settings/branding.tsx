import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { FloppyDisk, Palette } from "@phosphor-icons/react";
/**
 * Signing chrome settings (SEA-603)
 *
 * Sign-only white-label controls. Workspace brand colors and email from live
 * under General. This page keeps hideSealBranding + custom signing footer.
 *
 * Route: /{slug}/settings/branding
 * Gating: Pro Sign SKU (`PLAN_LIMITS.*.branding`)
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getBrandingSettings, updateBrandingSettings } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/settings/branding")(
  {
    component: BrandingSettings,
    pendingComponent: FormSkeleton,
  }
);

function BrandingSettings() {
  const { slug } = Route.useParams();

  const { data: brandingSettings } = useQuery({
    queryKey: ["branding", slug],
    queryFn: () => getBrandingSettings(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    enabled: false,
    hideSealBranding: false,
    customFooterText: "",
  });

  useEffect(() => {
    if (brandingSettings) {
      setFormData({
        enabled: brandingSettings.enabled === true,
        hideSealBranding: brandingSettings.hideSealBranding === true,
        customFooterText:
          typeof brandingSettings.customFooterText === "string"
            ? brandingSettings.customFooterText
            : "",
      });
    }
  }, [brandingSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateBrandingSettings(slug, {
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

  if (!brandingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Signing chrome">
      <FeatureGate
        tier="pro"
        feature="Signing chrome (Pro)"
        description="White-label the Seal signing page footer. Workspace brand colors and email from live under General."
      >
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <LayerCard className="border-dashed md:col-span-2">
            <LayerCard.Secondary>
              <Text as="h2" variant="heading">
                Suite vs Sign
              </Text>
              <Text variant="secondary">
                Tenant identity, colors, and email from belong on{" "}
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{ slug }}
                  to="/$slug/settings"
                >
                  General → Workspace profile
                </Link>
                . This page is Sign-only chrome gated by the Pro Sign SKU.
              </Text>
            </LayerCard.Secondary>
          </LayerCard>

          <LayerCard className="md:col-span-2">
            <LayerCard.Secondary>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <Text as="h2" variant="heading">
                  Enable signing chrome
                </Text>
              </div>
              <Text variant="secondary">
                When on, recipients see suite brand (from General) plus the
                footer controls below on the signing page and in document
                emails.
              </Text>
            </LayerCard.Secondary>
            <LayerCard.Primary>
              <Checkbox
                label="Apply custom signing chrome"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
              <Text variant="secondary" size="sm">
                Free workspaces keep Seal defaults (`PLAN_LIMITS.free.branding =
                false`).
              </Text>
            </LayerCard.Primary>
          </LayerCard>

          <LayerCard className="md:col-span-2">
            <LayerCard.Secondary>
              <Text as="h2" variant="heading">
                Signing footer (Seal)
              </Text>
              <Text variant="secondary">
                Product-owned chrome — stays on Seal after Core tenant brand.
              </Text>
            </LayerCard.Secondary>
            <LayerCard.Primary className="space-y-4">
              <Checkbox
                label='Hide "Powered by Seal"'
                checked={formData.hideSealBranding}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    hideSealBranding: checked,
                  })
                }
              />
              <Text variant="secondary" size="sm">
                Remove the Seal branding footer from signing pages.
              </Text>
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="custom-footer">Custom footer text</Label>
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
            </LayerCard.Primary>
          </LayerCard>

          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              <FloppyDisk className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving…" : "Save signing chrome"}
            </Button>
          </div>
        </form>
      </FeatureGate>
    </PageWrapper>
  );
}
