/**
 * Signer privacy notice dialog (SEA-52 / CCPA disclosures).
 * Shown before ESIGN consent so personal data processing is disclosed first.
 */

import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CheckCircle as CheckCircle2Icon } from "@phosphor-icons/react";
import { useCallback, useState } from "react";

import { SealLogo } from "@/components/seal-logo";

interface PrivacyNoticeDialogProps {
  recipientEmail: string;
  noticeText: string;
  onAccept: () => void;
  isSubmitting?: boolean;
}

export function PrivacyNoticeDialog({
  recipientEmail,
  noticeText,
  onAccept,
  isSubmitting = false,
}: PrivacyNoticeDialogProps) {
  const [accepted, setAccepted] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const handleAccept = useCallback(() => {
    setAccepted(true);
    onAccept();
  }, [onAccept]);

  if (accepted) {
    return (
      <div
        data-seal-enter
        className="bg-kumo-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-8"
      >
        <div className="flex w-full max-w-lg flex-col gap-6">
          <div className="flex justify-center">
            <SealLogo size={48} variant="color" />
          </div>
          <div className="flex flex-col gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2Icon className="text-kumo-default size-6" />
              <Text as="h1" variant="heading">Privacy notice acknowledged</Text>
            </div>
            <Text as="p" variant="secondary" size="sm">Continuing to electronic signature consent…</Text>
          </div>
          <LayerCard className="border-kumo-line">
            <LayerCard.Primary className="space-y-1 p-5 text-center">
              <Text as="p" size="sm">{recipientEmail}</Text>
            </LayerCard.Primary>
          </LayerCard>
        </div>
      </div>
    );
  }

  return (
    <div
      data-seal-enter
      className="bg-kumo-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-8"
    >
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex justify-center">
          <SealLogo size={48} variant="color" />
        </div>

        <div className="flex flex-col gap-2 text-center">
          <Text as="h1" variant="heading">Privacy notice</Text>
          <Text as="p" variant="secondary" size="sm">Please review how your information is used for this signing
            ceremony, including California privacy rights.</Text>
        </div>

        <LayerCard>
          <LayerCard.Primary className="max-h-vh-50 flex flex-col gap-3 overflow-y-auto p-5">
            {noticeText.split("\n").map((line, index) =>
              line.trim().length === 0 ? (
                <div key={`blank-${index}`} className="h-2" />
              ) : (
                <p
                  key={`${index}-${line.slice(0, 24)}`}
                  className="text-kumo-secondary text-sm leading-relaxed"
                >
                  {line}
                </p>
              )
            )}
          </LayerCard.Primary>
        </LayerCard>

        <Checkbox
          label="I have read and acknowledge this privacy notice."
          checked={isChecked}
          onCheckedChange={(value) => setIsChecked(value === true)}
        />

        <Button
          className="w-full"
          disabled={!isChecked || isSubmitting}
          onClick={handleAccept}
        >
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
