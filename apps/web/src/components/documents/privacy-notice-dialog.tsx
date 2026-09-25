/**
 * Signer privacy notice dialog (SEA-52 / CCPA disclosures).
 * Shown before ESIGN consent so personal data processing is disclosed first.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CheckCircle2Icon } from "lucide-react";
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
      <div className="dark:bg-background bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-center">
            <SealLogo size={48} variant="color" />
          </div>
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2Icon className="text-status-completed-text size-6" />
              <h1 className="text-2xl font-bold text-balance">
                Privacy notice acknowledged
              </h1>
            </div>
            <p className="text-muted-foreground text-sm text-pretty">
              Continuing to electronic signature consent…
            </p>
          </div>
          <LayerCard className="border-status-completed-border bg-status-completed-surface">
            <LayerCard.Primary className="space-y-1 p-5 text-center">
              <p className="text-status-completed-text text-sm font-medium">
                {recipientEmail}
              </p>
            </LayerCard.Primary>
          </LayerCard>
        </div>
      </div>
    );
  }

  return (
    <div className="dark:bg-background bg-background flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <SealLogo size={48} variant="color" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">
            Privacy notice
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Please review how your information is used for this signing
            ceremony, including California privacy rights.
          </p>
        </div>

        <LayerCard>
          <LayerCard.Primary className="max-h-[50vh] space-y-3 overflow-y-auto p-5">
            {noticeText.split("\n").map((line, index) =>
              line.trim().length === 0 ? (
                <div key={`blank-${index}`} className="h-2" />
              ) : (
                <p
                  key={`${index}-${line.slice(0, 24)}`}
                  className="text-muted-foreground text-sm leading-relaxed"
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
