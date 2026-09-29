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
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PenTool, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SigningChromeSection } from "@/components/settings/signing-chrome-section";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { FormSkeleton } from "@/components/skeletons";
import { getSigningSettings, updateSigningSettings } from "@/lib/api-client";
import { toast } from "@/lib/toast";

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

  const { data: signingSettings, isPending } = useQuery({
    queryKey: ["signing", slug],
    queryFn: () => getSigningSettings(slug),
    staleTime: 60_000,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    allowedSignatureTypes: SignatureTypeOption[];
    esignConsentText: string;
    privacyNoticeText: string;
    defaultDeadlineDays: number;
    requireRecipientAuth: boolean;
    requireSignerAccount: boolean;
  }>({
    allowedSignatureTypes: [...SIGNATURE_TYPE_OPTIONS],
    esignConsentText: "",
    privacyNoticeText: "",
    defaultDeadlineDays: 30,
    requireRecipientAuth: true,
    requireSignerAccount: true,
  });

  useEffect(() => {
    if (signingSettings) {
      setFormData({
        allowedSignatureTypes: [...signingSettings.allowedSignatureTypes],
        esignConsentText: signingSettings.esignConsentText ?? "",
        privacyNoticeText: signingSettings.privacyNoticeText ?? "",
        defaultDeadlineDays: signingSettings.defaultDeadlineDays,
        requireRecipientAuth: signingSettings.requireRecipientAuth,
        requireSignerAccount: signingSettings.requireSignerAccount,
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
        privacyNoticeText: formData.privacyNoticeText || undefined,
        defaultDeadlineDays: formData.defaultDeadlineDays,
        requireRecipientAuth: formData.requireRecipientAuth,
        requireSignerAccount: formData.requireSignerAccount,
        defaultRecipientAuthMethod: "email_otp",
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

  if (isPending || !signingSettings) {
    return (
      <PageWrapper title="Signing Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Signing Settings">
      <SettingsBody wide>
      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-2">
        <SettingsSection
          className="lg:col-span-2"
          icon={<PenTool className="size-4" />}
          title="Signature types"
          description="Methods recipients can use when signing."
        >
          {SIGNATURE_TYPE_OPTIONS.map((type) => (
            <Checkbox
              key={type}
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
        </SettingsSection>

        <SettingsSection
          className="lg:col-span-2"
          title="Identity & audit"
          description="Defaults for every envelope — inbox proof and optional Seal account."
        >
          <Checkbox
            checked={formData.requireRecipientAuth}
            disabled={isSubmitting}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                requireRecipientAuth: checked === true,
              }))
            }
            label="Require email OTP or access code for signers"
          />
          <Checkbox
            checked={formData.requireSignerAccount}
            disabled={isSubmitting}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                requireSignerAccount: checked === true,
              }))
            }
            label="Require Seal account before signing"
          />
        </SettingsSection>

        <SettingsSection
          title="Default deadline"
          description="Days recipients have to sign after send."
        >
          <div className="flex max-w-xs items-end gap-3">
            <div className="min-w-0 flex-1">
              <Input
                id="default-deadline-days"
                label="Days to sign"
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
            <span className="text-muted-foreground pb-2.5 text-sm whitespace-nowrap">
              after send
            </span>
          </div>
        </SettingsSection>

        <SettingsSection
          title="E-sign consent"
          description="Leave blank for the Seal default."
        >
          <Textarea
            id="esign-consent-text"
            value={formData.esignConsentText}
            disabled={isSubmitting}
            onChange={(e) =>
              setFormData({ ...formData, esignConsentText: e.target.value })
            }
            placeholder="By signing this document electronically..."
            rows={4}
          />
        </SettingsSection>

        <SettingsSection
          className="lg:col-span-2"
          title="Privacy / CCPA notice"
          description="Leave blank for the Seal default."
        >
          <Textarea
            id="privacy-notice-text"
            value={formData.privacyNoticeText}
            disabled={isSubmitting}
            onChange={(e) =>
              setFormData({ ...formData, privacyNoticeText: e.target.value })
            }
            placeholder="Privacy notice for electronic signing..."
            rows={5}
          />
        </SettingsSection>

        <div className="flex justify-end lg:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <SigningChromeSection slug={slug} />
      </SettingsBody>
    </PageWrapper>
  );
}
