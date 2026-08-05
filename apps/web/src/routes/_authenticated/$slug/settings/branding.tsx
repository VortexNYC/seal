/**
 * Signing chrome settings (SEA-603)
 *
 * Sign-only white-label controls. Suite tenant identity (name / slug / logo /
 * colors / email from) moves to Core VortexOrgProfile via VOR-182 — until then
 * logo/colors/email still write Seal brandingSettings so signing keeps working.
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
import {
  ImageIcon,
  PaletteIcon,
  Save,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const generateLogoUploadUrl = useMutation(
    api.organizations.mutations.generateLogoUploadUrl
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    enabled: false,
    brandColor: "",
    accentColor: "",
    emailFromName: "",
    emailReplyTo: "",
    hideSealBranding: false,
    customFooterText: "",
  });

  const [logoUrl, setLogoUrl] = useState<string | undefined>();

  useEffect(() => {
    if (brandingSettings) {
      setFormData({
        enabled: brandingSettings.enabled,
        brandColor: brandingSettings.brandColor ?? "",
        accentColor: brandingSettings.accentColor ?? "",
        emailFromName: brandingSettings.emailFromName ?? "",
        emailReplyTo: brandingSettings.emailReplyTo ?? "",
        hideSealBranding: brandingSettings.hideSealBranding ?? false,
        customFooterText: brandingSettings.customFooterText ?? "",
      });
      setLogoUrl(brandingSettings.logoUrl ?? undefined);
    }
  }, [brandingSettings]);

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (
        !["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(
          file.type
        )
      ) {
        toast.error("Please upload a PNG, JPG, SVG, or WebP image");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo must be under 2MB");
        return;
      }

      setIsUploading(true);
      try {
        const uploadUrl = await generateLogoUploadUrl({});

        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        const { storageId } = await result.json();

        await updateBranding({ logoStorageId: storageId });
        toast.success("Logo uploaded");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload logo"
        );
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [generateLogoUploadUrl, updateBranding]
  );

  const handleRemoveLogo = useCallback(async () => {
    try {
      await updateBranding({ removeLogo: true });
      setLogoUrl(undefined);
      toast.success("Logo removed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove logo"
      );
    }
  }, [updateBranding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (formData.emailReplyTo && !formData.emailReplyTo.includes("@")) {
        toast.error("Please enter a valid reply-to email address");
        setIsSubmitting(false);
        return;
      }

      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      if (formData.brandColor && !hexRegex.test(formData.brandColor)) {
        toast.error(
          "Brand color must be a valid hex color (for example, a 6-digit hex value)"
        );
        setIsSubmitting(false);
        return;
      }
      if (formData.accentColor && !hexRegex.test(formData.accentColor)) {
        toast.error(
          "Accent color must be a valid hex color (for example, a 6-digit hex value)"
        );
        setIsSubmitting(false);
        return;
      }

      await updateBranding({
        enabled: formData.enabled,
        brandColor: formData.brandColor || undefined,
        accentColor: formData.accentColor || undefined,
        emailFromName: formData.emailFromName || undefined,
        emailReplyTo: formData.emailReplyTo || undefined,
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
        description="White-label the Seal signing page and document emails. Workspace name and logo also live under General (Core org profile)."
      >
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <Card className="md:col-span-2 border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Suite vs Sign</CardTitle>
              <CardDescription>
                Tenant identity (name, slug, logo) belongs on{" "}
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  params={{ slug }}
                  to="/$slug/settings"
                >
                  General → Workspace profile
                </Link>
                . Full tenant brand colors / email from move to Core when{" "}
                <span className="font-medium">VOR-182</span> ships. This page is
                Sign-only chrome gated by the Pro Sign SKU.
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
                When on, recipients see your logo, colors, and footer on the
                signing page and in document emails.
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

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <CardTitle className="text-base">Signing logo</CardTitle>
              </div>
              <CardDescription>
                Temporary Seal store until Core tenant brand (VOR-182). Prefer
                matching the workspace profile logo on General.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logoUrl ? (
                <div className="space-y-3">
                  <div className="bg-muted/50 flex items-center justify-center rounded-lg border p-6">
                    <img
                      src={logoUrl}
                      alt="Organization logo"
                      className="h-12 max-w-[200px] object-contain"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="mr-2 h-3.5 w-3.5" />
                    Remove logo
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="border-border bg-muted/30 hover:bg-muted/50 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors"
                >
                  <UploadIcon className="text-muted-foreground h-8 w-8" />
                  <span className="text-muted-foreground text-sm">
                    {isUploading ? "Uploading..." : "Click to upload logo"}
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PaletteIcon className="h-5 w-5" />
                <CardTitle className="text-base">Signing colors</CardTitle>
              </div>
              <CardDescription>
                Buttons and accents on `sign.$token`. Moves to Core tenant brand
                with VOR-182.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand-color" className="text-sm">
                  Primary brand color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brand-color"
                    placeholder="6-digit hex value"
                    value={formData.brandColor}
                    onChange={(e) =>
                      setFormData({ ...formData, brandColor: e.target.value })
                    }
                    className="font-mono"
                  />
                  {formData.brandColor &&
                    /^#[0-9a-fA-F]{6}$/.test(formData.brandColor) && (
                      <div
                        className="size-9 shrink-0 rounded-md border"
                        style={{ backgroundColor: formData.brandColor }}
                      />
                    )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color" className="text-sm">
                  Accent color
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="accent-color"
                    placeholder="6-digit hex value"
                    value={formData.accentColor}
                    onChange={(e) =>
                      setFormData({ ...formData, accentColor: e.target.value })
                    }
                    className="font-mono"
                  />
                  {formData.accentColor &&
                    /^#[0-9a-fA-F]{6}$/.test(formData.accentColor) && (
                      <div
                        className="size-9 shrink-0 rounded-md border"
                        style={{ backgroundColor: formData.accentColor }}
                      />
                    )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document email chrome</CardTitle>
              <CardDescription>
                From / reply-to for Seal document emails. Suite email identity
                lands in Core with VOR-182; auth mail already uses Auth drafts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-from-name" className="text-sm">
                  From name
                </Label>
                <Input
                  id="email-from-name"
                  placeholder="e.g. Acme Legal"
                  value={formData.emailFromName}
                  onChange={(e) =>
                    setFormData({ ...formData, emailFromName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-reply-to" className="text-sm">
                  Reply-to address
                </Label>
                <Input
                  id="email-reply-to"
                  type="email"
                  placeholder="legal@acme.com"
                  value={formData.emailReplyTo}
                  onChange={(e) =>
                    setFormData({ ...formData, emailReplyTo: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
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
