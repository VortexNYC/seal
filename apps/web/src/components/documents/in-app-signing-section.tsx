import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  PenLineIcon,
  XCircleIcon,
} from "lucide-react";
import type { JSX } from "react";

import { cn } from "@/lib/utils";

type FieldType = string;

type RecipientStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "approved"
  | "declined"
  | "expired";

interface FieldWithValue {
  _id: string;
  fieldType: FieldType;
  page: number;
  label?: string;
  isRequired: boolean;
  isFilled: boolean;
}

interface RecipientData {
  _id: string;
  name?: string;
  email: string;
  role: "signer" | "viewer" | "approver";
  status: RecipientStatus;
  signingToken?: string;
}

interface InAppSigningSectionProps {
  documentId: string;
  recipient: RecipientData;
  fields: FieldWithValue[];
  isOpen: boolean;
  onOpenChange: () => void;
  onFieldsRefetch: () => void;
}

export function InAppSigningSection({
  documentId,
  recipient,
  fields,
  isOpen,
  onOpenChange,
  onFieldsRefetch,
}: InAppSigningSectionProps): JSX.Element {
  void documentId;
  void onFieldsRefetch;

  const requiredFields = fields.filter((f) => f.isRequired);
  const filledRequiredFields = requiredFields.filter((f) => f.isFilled);
  const progress =
    requiredFields.length > 0
      ? Math.round((filledRequiredFields.length / requiredFields.length) * 100)
      : 100;

  const canSign =
    recipient.status === "pending" || recipient.status === "viewed";
  const isCompleted =
    recipient.status === "signed" || recipient.status === "approved";
  const isDeclined = recipient.status === "declined";
  const signingHref = recipient.signingToken
    ? `/sign/${recipient.signingToken}`
    : null;

  const getStatusConfig = (): {
    bgColor: string;
    textColor: string;
    icon: typeof CheckCircleIcon;
    label: string;
  } => {
    if (isCompleted) {
      return {
        bgColor: "bg-success-surface",
        textColor: "text-success",
        icon: CheckCircleIcon,
        label: recipient.status === "approved" ? "Approved" : "Signed",
      };
    }
    if (isDeclined) {
      return {
        bgColor: "bg-destructive/10",
        textColor: "text-destructive",
        icon: XCircleIcon,
        label: "Declined",
      };
    }
    return {
      bgColor: "bg-warning-surface",
      textColor: "text-warning",
      icon: ClockIcon,
      label: "Pending",
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Collapsible.Root open={isOpen} onOpenChange={onOpenChange}>
      <Collapsible.Trigger className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg px-1 py-2 text-left">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              status.bgColor,
              status.textColor
            )}
          >
            <StatusIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-foreground text-sm font-semibold">
              Your Signature
            </div>
            <div className={cn("text-xs font-medium", status.textColor)}>
              {status.label}
            </div>
          </div>
        </div>
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Collapsible.Trigger>

      <Collapsible.Panel className="px-1 pt-2 pb-1">
        {canSign && requiredFields.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Progress</span>
              <span>
                {filledRequiredFields.length} of {requiredFields.length}{" "}
                required fields
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-warning h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {canSign && (
          <div className="mt-4 space-y-2">
            {signingHref ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Open the secure signing page to review and complete your
                  fields.
                </p>
                <Button
                  className="h-11 w-full text-sm font-medium"
                  type="button"
                  onClick={() => {
                    window.open(signingHref, "_blank", "noopener,noreferrer");
                  }}
                >
                  <PenLineIcon className="mr-2 h-4 w-4" />
                  Open signing page
                  <ExternalLinkIcon className="ml-2 h-3.5 w-3.5 opacity-70" />
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Your signing link is not available yet. Check your email for
                  the invitation, or ask the sender to resend it.
                </p>
                <Button
                  disabled
                  className="h-11 w-full text-sm font-medium"
                  type="button"
                >
                  <PenLineIcon className="mr-2 h-4 w-4" />
                  Signing link unavailable
                </Button>
              </>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="bg-success-surface/50 mt-4 rounded-xl py-5 text-center">
            <div className="bg-success-surface text-success mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div className="text-foreground font-sans text-sm font-semibold">
              {recipient.status === "approved"
                ? "You have approved this document"
                : "You have signed this document"}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              A copy has been sent to your email
            </p>
          </div>
        )}

        {isDeclined && (
          <div className="mt-4 py-4 text-center">
            <div className="bg-destructive/10 text-destructive mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <XCircleIcon className="h-6 w-6" />
            </div>
            <div className="text-foreground font-sans text-sm font-semibold">
              You have declined this document
            </div>
          </div>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
