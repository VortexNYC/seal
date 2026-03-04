/**
 * ESIGN Act Consent Dialog
 *
 * Displays a full-screen consent modal that recipients must accept before
 * they can view or sign documents electronically. Required for ESIGN Act
 * and UETA compliance.
 *
 * Shows three states:
 * 1. Initial consent form with checkbox
 * 2. Accepted confirmation (brief, auto-proceeds)
 * 3. Declined with alternative options
 */

import { CheckCircle2Icon, DownloadIcon, FileTextIcon, MailIcon, XCircleIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { SealLogo } from "@/components/seal-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type ConsentState = "pending" | "accepted" | "declined";

interface EsignConsentDialogProps {
  recipientEmail: string;
  onAccept: () => void;
  onDecline: () => void;
  onDownloadPdf?: () => void;
  onOptOut?: (method: string) => void;
  isSubmitting?: boolean;
  /** Custom consent text from org settings. Falls back to Seal default when absent. */
  customConsentText?: string;
}

export function EsignConsentDialog({
  recipientEmail,
  onAccept,
  onDecline,
  onDownloadPdf,
  onOptOut,
  isSubmitting = false,
  customConsentText,
}: EsignConsentDialogProps) {
  const [consentState, setConsentState] = useState<ConsentState>("pending");
  const [isChecked, setIsChecked] = useState(false);

  const handleAccept = useCallback(() => {
    setConsentState("accepted");
    onAccept();
  }, [onAccept]);

  const handleDecline = useCallback(() => {
    setConsentState("declined");
    onDecline();
  }, [onDecline]);

  const handleBackToConsent = useCallback(() => {
    setConsentState("pending");
    setIsChecked(false);
  }, []);

  // Declined state
  if (consentState === "declined") {
    return (
      <div className="dark:bg-background flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-center">
            <SealLogo size={48} variant="color" />
          </div>

          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <XCircleIcon className="text-destructive size-6" />
              <h1 className="text-2xl font-bold text-balance">Electronic Signature Declined</h1>
            </div>
            <p className="text-muted-foreground text-sm text-pretty">
              You have declined to use electronic signatures. Unfortunately, this document requires
              electronic signatures to proceed.
            </p>
          </div>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Alternative options:</p>
              <div className="space-y-2">
                {onDownloadPdf && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      onOptOut?.("download_pdf");
                      onDownloadPdf();
                    }}
                  >
                    <DownloadIcon className="mr-2 size-4" />
                    Download PDF for Manual Signing
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onOptOut?.("paper_copy_request");
                    window.location.href = `mailto:support@seal.nyc?subject=Paper%20Copy%20Request&body=I%20would%20like%20to%20request%20a%20paper%20copy%20of%20the%20document.%20My%20email%20is%20${encodeURIComponent(recipientEmail)}`;
                  }}
                >
                  <FileTextIcon className="mr-2 size-4" />
                  Request Paper Copy
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    onOptOut?.("contact_sender");
                    window.location.href = `mailto:support@seal.nyc?subject=Document%20Signing%20Assistance&body=I%20need%20assistance%20with%20a%20document%20I%20was%20asked%20to%20sign.%20My%20email%20is%20${encodeURIComponent(recipientEmail)}`;
                  }}
                >
                  <MailIcon className="mr-2 size-4" />
                  Contact Document Sender
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button variant="ghost" onClick={handleBackToConsent}>
              Back to Consent
            </Button>
          </div>

          <p className="text-muted-foreground text-center text-xs">
            For assistance, please contact:{" "}
            <a href="mailto:support@seal.nyc" className="underline underline-offset-2">
              support@seal.nyc
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Accepted state (brief flash before proceeding)
  if (consentState === "accepted") {
    return (
      <div className="dark:bg-background flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex justify-center">
            <SealLogo size={48} variant="color" />
          </div>

          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2Icon className="text-success size-6" />
              <h1 className="text-2xl font-bold text-balance">Consent Accepted</h1>
            </div>
            <p className="text-muted-foreground text-sm text-pretty">
              Thank you for providing your consent. Loading your document...
            </p>
          </div>

          <Card className="border-status-completed-border bg-status-completed-surface">
            <CardContent className="space-y-1 p-5 text-center">
              <p className="text-status-completed-text text-sm font-medium">
                {recipientEmail}
              </p>
              <p className="text-status-completed-text/80 text-xs">
                Consent Date:{" "}
                {new Date().toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Initial consent form
  return (
    <div className="dark:bg-background flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <SealLogo size={48} variant="color" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">
            Electronic Signature Consent
          </h1>
          <p className="text-muted-foreground text-sm text-pretty">
            Before you can sign documents electronically, please review and accept the following:
          </p>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Electronic Signature Agreement</h2>
          <Card className="border-info-surface bg-info-surface/50">
            <CardContent className="space-y-4 p-5">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {customConsentText ??
                  "By checking the box below, you consent to use electronic signatures for this document and future documents."}
              </p>

              <div>
                <p className="mb-2 text-sm font-medium">You acknowledge that:</p>
                <ul className="text-muted-foreground space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                    Electronic signatures have the same legal effect as handwritten signatures under
                    the ESIGN Act
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                    You can request paper copies at any time
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                    You can withdraw consent by contacting us
                  </li>
                </ul>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Technical Requirements:</p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                    Modern web browser with JavaScript enabled
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 block size-1 shrink-0 rounded-full bg-current" />
                    Email access to receive signed documents
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="esign-consent"
            checked={isChecked}
            onCheckedChange={(checked) => setIsChecked(checked === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="esign-consent"
            className="cursor-pointer text-sm leading-snug font-medium"
          >
            I consent to use electronic signatures as described above
          </Label>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            size="lg"
            disabled={!isChecked || isSubmitting}
            onClick={handleAccept}
          >
            {isSubmitting ? "Recording consent..." : "Continue to Document"}
          </Button>
          <div className="text-center">
            <Button variant="ghost" onClick={handleDecline}>
              Decline &amp; Exit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
