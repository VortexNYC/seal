/**
 * Branding Settings Page
 *
 * Organization branding controls for signing pages and emails (admin-only).
 * Route: /{slug}/settings/branding
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Building2Icon, ImageIcon, PaletteIcon, Save, Trash2Icon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/$slug/settings/branding")({
  component: BrandingSettings,
  pendingComponent: FormSkeleton,
});

function BrandingSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const brandingSettings = useQuery(
    api.organizations.queries.getBrandingSettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateBranding = useMutation(api.organizations.mutations.updateBrandingSettings);
  const generateLogoUploadUrl = useMutation(api.organizations.mutations.generateLogoUploadUrl);

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
    companyName: "",
    companyWebsite: "",
  });

  // Track logo state separately (it's uploaded directly, not part of form submit)
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
        companyName: brandingSettings.companyName ?? "",
        companyWebsite: brandingSettings.companyWebsite ?? "",
      });
      setLogoUrl(brandingSettings.logoUrl ?? undefined);
    }
  }, [brandingSettings]);

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
        toast.error("Please upload a PNG, JPG, SVG, or WebP image");
        return;
      }

      // Validate file size (2MB max)
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
        toast.error(error instanceof Error ? error.message : "Failed to upload logo");
      } finally {
        setIsUploading(false);
        // Reset input so same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [generateLogoUploadUrl, updateBranding],
  );

  const handleRemoveLogo = useCallback(async () => {
    try {
      await updateBranding({ removeLogo: true });
      setLogoUrl(undefined);
      toast.success("Logo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove logo");
    }
  }, [updateBranding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate email if provided
      if (formData.emailReplyTo && !formData.emailReplyTo.includes("@")) {
        toast.error("Please enter a valid reply-to email address");
        setIsSubmitting(false);
        return;
      }

      // Validate hex colors if provided
      const hexRegex = /^#[0-9a-fA-F]{6}$/;
      if (formData.brandColor && !hexRegex.test(formData.brandColor)) {
        toast.error("Brand color must be a valid hex color (for example, a 6-digit hex value)");
        setIsSubmitting(false);
        return;
      }
      if (formData.accentColor && !hexRegex.test(formData.accentColor)) {
        toast.error("Accent color must be a valid hex color (for example, a 6-digit hex value)");
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
        companyName: formData.companyName || undefined,
        companyWebsite: formData.companyWebsite || undefined,
      });
      toast.success("Branding settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update branding settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !brandingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Branding">
      <FeatureGate
        tier="pro"
        feature="Custom branding"
        description="Add your logo and colors to signing pages and emails."
      >
        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          {/* Master Switch */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PaletteIcon className="h-5 w-5" />
                <CardTitle>Custom Branding</CardTitle>
              </div>
              <CardDescription>
                Customize the signing experience with your brand. Recipients will see your logo,
                colors, and messaging instead of Seal defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="branding-enabled" className="text-sm font-medium">
                    Enable custom branding
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    When enabled, your branding will appear on signing pages and email
                    notifications.
                  </p>
                </div>
                <Switch
                  id="branding-enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2Icon className="h-5 w-5" />
                <CardTitle className="text-base">Company Information</CardTitle>
              </div>
              <CardDescription>
                Your company details shown on signing pages and documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-sm">
                  Company name
                </Label>
                <Input
                  id="company-name"
                  placeholder="e.g. Acme Corp"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website" className="text-sm">
                  Company website
                </Label>
                <Input
                  id="company-website"
                  type="url"
                  placeholder="https://acme.com"
                  value={formData.companyWebsite}
                  onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <CardTitle className="text-base">Logo</CardTitle>
              </div>
              <CardDescription>
                Upload your organization logo for the signing page header. Max 2MB,
                PNG/JPG/SVG/WebP.
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

          {/* Colors */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PaletteIcon className="h-5 w-5" />
                <CardTitle className="text-base">Colors</CardTitle>
              </div>
              <CardDescription>
                Set your brand colors for buttons and accents on the signing page.
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
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    className="font-mono"
                  />
                  {formData.brandColor && /^#[0-9a-fA-F]{6}$/.test(formData.brandColor) && (
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
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="font-mono"
                  />
                  {formData.accentColor && /^#[0-9a-fA-F]{6}$/.test(formData.accentColor) && (
                    <div
                      className="size-9 shrink-0 rounded-md border"
                      style={{ backgroundColor: formData.accentColor }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Customization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email Customization</CardTitle>
              <CardDescription>Customize how your emails appear to recipients.</CardDescription>
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
                  onChange={(e) => setFormData({ ...formData, emailFromName: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  Shown as the sender name in email notifications.
                </p>
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
                  onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  Recipients who reply will reach this address instead of no-reply.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Signing Page */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signing Page</CardTitle>
              <CardDescription>
                Control what appears on the signing experience footer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="hide-seal-branding" className="text-sm font-medium">
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
                  onChange={(e) => setFormData({ ...formData, customFooterText: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </FeatureGate>
    </PageWrapper>
  );
}
