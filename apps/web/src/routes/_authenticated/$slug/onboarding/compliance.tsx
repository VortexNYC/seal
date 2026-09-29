/**
 * Compliance onboarding after workspace create.
 * Seeds signing settings that feed send/sign enforcement.
 * Route: /{slug}/onboarding/compliance
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useState, type ReactElement } from "react";

import Loader from "@/components/loader";
import { getSigningSettings, updateSigningSettings } from "@/lib/api-client";
import { buildOrganizationPath } from "@/lib/organization-path";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/onboarding/compliance"
)({
  component: ComplianceOnboarding,
});

function ComplianceOnboarding(): ReactElement {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  const { data: signingSettings, isPending } = useQuery({
    queryKey: ["signing", slug],
    queryFn: () => getSigningSettings(slug),
  });

  const [requireRecipientAuth, setRequireRecipientAuth] = useState(true);
  const [requireSignerAccount, setRequireSignerAccount] = useState(true);

  useEffect(() => {
    if (!signingSettings) {
      return;
    }
    setRequireRecipientAuth(signingSettings.requireRecipientAuth);
    setRequireSignerAccount(signingSettings.requireSignerAccount);
  }, [signingSettings]);

  const save = useMutation({
    mutationFn: () =>
      updateSigningSettings(slug, {
        requireRecipientAuth,
        requireSignerAccount,
        defaultRecipientAuthMethod: "email_otp",
        defaultDeadlineDays: signingSettings?.defaultDeadlineDays ?? 30,
        allowedSignatureTypes: signingSettings?.allowedSignatureTypes ?? [
          "draw",
          "type",
          "upload",
        ],
      }),
    onSuccess: () => {
      toast.success("Compliance defaults saved");
      void navigate({
        to: buildOrganizationPath(slug, "/home"),
        replace: true,
      });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    },
  });

  if (isPending || !signingSettings) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <Loader />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="flex flex-col gap-2 text-center">
        <div className="bg-kumo-elevated mx-auto flex size-12 items-center justify-center rounded-full">
          <ShieldCheck className="size-6" weight="duotone" />
        </div>
        <Text as="h1" size="lg" variant="heading">
          Signing compliance
        </Text>
        <Text as="p" size="sm" variant="secondary">
          These defaults protect your audit trail. They apply to every envelope
          you send from this workspace — change them anytime in Settings →
          Signing.
        </Text>
      </div>

      <LayerCard className="w-full">
        <LayerCard.Primary className="flex flex-col gap-5 p-[clamp(1rem,4vw,1.5rem)]">
          <Checkbox
            checked={requireRecipientAuth}
            onCheckedChange={(checked) =>
              setRequireRecipientAuth(checked === true)
            }
            label="Require email OTP or access code for signers"
          />
          <Text as="p" size="xs" variant="secondary">
            Signers prove they control the invited inbox before they can act.
            Link-only signing is blocked at send.
          </Text>

          <Checkbox
            checked={requireSignerAccount}
            onCheckedChange={(checked) =>
              setRequireSignerAccount(checked === true)
            }
            label="Require a Seal account before signing"
          />
          <Text as="p" size="xs" variant="secondary">
            Recipients create a quick account (or sign in) with the invited
            email so completions are tied to a durable identity.
          </Text>

          <Button
            className="min-h-12 w-full text-base"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            type="button"
            variant="primary"
            data-testid="compliance-continue"
          >
            {save.isPending ? "Saving…" : "Save and continue"}
          </Button>
        </LayerCard.Primary>
      </LayerCard>
    </div>
  );
}
