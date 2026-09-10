/**
 * Signing Settings Page
 *
 * Organization signing defaults (admin-only mutations)
 * Route: /{slug}/settings/signing
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PenTool, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getOrganization, getSigningSettings, updateSigningSettings } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

  const { data: organization } = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => getOrganization(slug),
  });

  const { data: signingSettings } = useQuery({
    queryKey: ["signing", slug],
    queryFn: () => getSigningSettings(slug),
    enabled: !!organization,
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

  if (!organization || !signingSettings) {
    return null;
  }

  return (
    <PageWrapper title="Signing Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PenTool className="size-5" />
              <CardTitle>Signature Types</CardTitle>
            </div>
            <CardDescription>
              Choose which signature methods recipients can use when signing
              documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SIGNATURE_TYPE_OPTIONS.map((type) => (
              <div key={type} className="flex items-center gap-3">
                <Checkbox
                  id={`sig-${type}`}
                  checked={formData.allowedSignatureTypes.includes(type)}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) =>
                    handleSignatureTypeToggle(type, checked === true)
                  }
                  aria-label={`${type === "draw" ? "Draw signature" : type === "type" ? "Type signature" : "Upload signature image"} option`}
                />
                <Label htmlFor={`sig-${type}`} className="text-sm font-medium">
                  {type === "draw"
                    ? "Draw signature"
                    : type === "type"
                      ? "Type signature"
                      : "Upload signature image"}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Deadline</CardTitle>
            <CardDescription>
              Default number of days recipients have to sign after a document is
              sent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Label htmlFor="default-deadline-days" className="sr-only">
                Default deadline in days
              </Label>
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
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">days</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>E-Sign Consent Text</CardTitle>
            <CardDescription>
              Custom text shown in the e-sign consent dialog. Leave blank to use
              the Seal default.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
            <p
              id="esign-consent-help"
              className="text-muted-foreground mt-2 text-xs"
            >
              This text is shown to recipients before they can sign.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
