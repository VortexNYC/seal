/**
 * Sign-only chrome (footer) — lives under Signing settings (was /settings/branding).
 */
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { FloppyDisk, Palette } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactElement } from "react";

import { FeatureGate } from "@/components/feature-gate";
import { FormSkeleton } from "@/components/skeletons";
import { getBrandingSettings, updateBrandingSettings } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function SigningChromeSection({
  slug,
}: {
  slug: string;
}): ReactElement {
  const { data: brandingSettings, isPending } = useQuery({
    queryKey: ["branding", slug],
    queryFn: () => getBrandingSettings(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    enabled: false,
    customFooterText: "",
  });

  useEffect(() => {
    if (brandingSettings) {
      setFormData({
        enabled: brandingSettings.enabled === true,
        customFooterText:
          typeof brandingSettings.customFooterText === "string"
            ? brandingSettings.customFooterText
            : "",
      });
    }
  }, [brandingSettings]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateBrandingSettings(slug, {
        enabled: formData.enabled,
        hideSealBranding: false,
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

  if (isPending || !brandingSettings) {
    return <FormSkeleton />;
  }

  return (
    <FeatureGate
      tier="pro"
      feature="Signing chrome (Pro)"
      description="White-label signing page footer text. Workspace brand colors and email from live under General. Seal product identity stays on."
    >
      <form
        id="signing-chrome"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="flex flex-col gap-5"
      >
        <LayerCard className="border-dashed">
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Signing chrome
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
              . This section is Sign-only chrome gated by the Pro Sign SKU.
            </Text>
          </LayerCard.Secondary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              <Text as="h2" variant="heading">
                Enable signing chrome
              </Text>
            </div>
            <Text variant="secondary">
              When on, recipients see suite brand (from General) plus optional
              custom footer text on the signing page and in document emails.
              Seal product chrome stays visible.
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
              Free workspaces keep Seal defaults.
            </Text>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Custom footer text
            </Text>
            <Text variant="secondary">
              Optional line under the signing surface (e.g. confidentiality
              notice). Does not replace Seal identity.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Input
              id="custom-footer"
              label="Footer text"
              placeholder="e.g. Acme Corp — Confidential"
              value={formData.customFooterText}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  customFooterText: e.target.value,
                })
              }
            />
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save signing chrome"}
          </Button>
        </div>
      </form>
    </FeatureGate>
  );
}
