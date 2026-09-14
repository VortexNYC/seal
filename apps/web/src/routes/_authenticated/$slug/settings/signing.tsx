/**
 * Signing Settings Page
 *
 * Organization signing defaults (admin-only mutations)
 * Route: /{slug}/settings/signing
 */

import { Textarea } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PenTool, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getSigningSettings, updateSigningSettings } from "@/lib/api-client";

type SignatureTypeOption = "draw" | "type" | "upload";

const SIGNATURE_TYPE_OPTIONS = [
  "draw",
  "type",
  "upload",
] as const satisfies readonly SignatureTypeOption[];

export const Route = createFileRoute("/_authenticated/$slug/settings/signing")({
  component: SigningSettings,
  pendingComponent: FormSkeleton,
});

function SigningSettings() {
  const { slug } = Route.useParams();

  const { data: signingSettings } = useQuery({
    queryKey: ["signing", slug],
    queryFn: () => getSigningSettings(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    allowedSignatureTypes: SignatureTypeOption[];
    esignConsentText: string;
    defaultDeadlineDays: number;
  }>({
    allowedSignatureTypes: [...SIGNATURE_TYPE_OPTIONS],
    esignConsentText: "",
    defaultDeadlineDays: 30,
  });

  useEffect(() => {
    if (signingSettings) {
      setFormData({
        allowedSignatureTypes: [...signingSettings.allowedSignatureTypes],
        esignConsentText: signingSettings.esignConsentText ?? "",
        defaultDeadlineDays: signingSettings.defaultDeadlineDays,
      });
    }
  }, [signingSettings]);

  const handleSignatureTypeToggle = (
    type: SignatureTypeOption,
    checked: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      allowedSignatureTypes: checked
        ? [...prev.allowedSignatureTypes, type]
        : prev.allowedSignatureTypes.filter((t) => t !== type),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.allowedSignatureTypes.length === 0) {
      toast.error("At least one signature type must be allowed");
      return;
    }

    if (
      formData.defaultDeadlineDays < 1 ||
      formData.defaultDeadlineDays > 365
    ) {
      toast.error("Deadline must be between 1 and 365 days");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSigningSettings(slug, {
        allowedSignatureTypes: formData.allowedSignatureTypes,
        esignConsentText: formData.esignConsentText || undefined,
        defaultDeadlineDays: formData.defaultDeadlineDays,
      });
      toast.success("Signing settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update signing settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!signingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Signing Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <PenTool className="size-5" />
              <Text as="h2" variant="heading">
                Signature Types
              </Text>
            </div>
            <Text variant="secondary">
              Choose which signature methods recipients can use when signing
              documents.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="space-y-4">
              {SIGNATURE_TYPE_OPTIONS.map((type) => (
                <Checkbox
                  checked={formData.allowedSignatureTypes.includes(type)}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) =>
                    handleSignatureTypeToggle(type, checked === true)
                  }
                  label={
                    type === "draw"
                      ? "Draw signature"
                      : type === "type"
                        ? "Type signature"
                        : "Upload signature image"
                  }
                />
              ))}
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Default Deadline
            </Text>
            <Text variant="secondary">
              Default number of days recipients have to sign after a document is
              sent.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="flex items-center gap-2">
              <Label htmlFor="default-deadline-days" className="sr-only">
                Default deadline in days
              </Label>
              <div className="w-24">
                <Input
                  id="default-deadline-days"
                  type="number"
                  min={1}
                  max={365}
                  value={formData.defaultDeadlineDays}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultDeadlineDays: Number(e.target.value),
                    })
                  }
                />
              </div>
              <Text variant="secondary" as="span">
                days
              </Text>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              E-Sign Consent Text
            </Text>
            <Text variant="secondary">
              Custom text shown in the e-sign consent dialog. Leave blank to use
              the Seal default.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Textarea
              id="esign-consent-text"
              value={formData.esignConsentText}
              disabled={isSubmitting}
              onChange={(e) =>
                setFormData({ ...formData, esignConsentText: e.target.value })
              }
              placeholder="By signing this document electronically..."
              rows={4}
              aria-describedby="esign-consent-help"
            />
            <Text variant="secondary" as="p" id="esign-consent-help">
              This text is shown to recipients before they can sign.
            </Text>
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
