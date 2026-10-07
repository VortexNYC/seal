import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { CaretDown as ChevronDownIcon, CheckCircle as CheckCircleIcon, Clock as ClockIcon, Pen as PenLineIcon, XCircle as XCircleIcon } from "@phosphor-icons/react";
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
        bgColor: "bg-kumo-elevated",
        textColor: "text-kumo-default",
        icon: CheckCircleIcon,
        label: recipient.status === "approved" ? "Approved" : "Signed",
      };
    }
    if (isDeclined) {
      return {
        bgColor: "bg-kumo-danger/10",
        textColor: "text-kumo-danger",
        icon: XCircleIcon,
        label: "Declined",
      };
    }
    return {
      bgColor: "bg-kumo-elevated",
      textColor: "text-kumo-secondary",
      icon: ClockIcon,
      label: "Pending",
    };
  };

  const status = getStatusConfig();
  const StatusIcon = status.icon;

  return (
    <Collapsible.Root open={isOpen} onOpenChange={onOpenChange}>
      <Collapsible.Trigger className="flex w-full items-center justify-between text-left">
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
            <div className="text-kumo-default text-sm font-semibold">
              Your Signature
            </div>
            <div className={cn("text-xs font-medium", status.textColor)}>
              {status.label}
            </div>
          </div>
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Collapsible.Trigger>

      <Collapsible.Panel className="px-1 pt-2 pb-1">
        {canSign && requiredFields.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="text-kumo-secondary flex items-center justify-between text-xs">
              <span>Progress</span>
              <span>
                {filledRequiredFields.length} of {requiredFields.length}{" "}
                required fields
              </span>
            </div>
            <div className="bg-kumo-elevated h-2 overflow-hidden rounded-full">
              <div
                className="bg-kumo-default transition-width h-full rounded-full duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {canSign && (
          <div className="mt-4 space-y-2">
            {signingHref ? (
              <>
                <Text as="p" variant="secondary" size="sm">Open the secure signing page to review and complete your
                  fields.</Text>
                <Button
                  className="w-full"
                  size="lg"
                  type="button"
                  icon={PenLineIcon}
                  onClick={() => {
                    window.open(signingHref, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open signing page
                </Button>
              </>
            ) : (
              <>
                <Text as="p" variant="secondary" size="sm">Your signing link is not available yet. Check your email for
                  the invitation, or ask the sender to resend it.</Text>
                <Button
                  disabled
                  className="w-full"
                  size="lg"
                  type="button"
                  icon={PenLineIcon}
                >
                  Signing link unavailable
                </Button>
              </>
            )}
          </div>
        )}

        {isCompleted && (
          <div className="bg-kumo-elevated mt-4 rounded-xl py-5 text-center">
            <div className="bg-kumo-base text-kumo-default mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div className="text-kumo-default font-sans text-sm font-semibold">
              {recipient.status === "approved"
                ? "You have approved this document"
                : "You have signed this document"}
            </div>
            <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mt-1">A copy has been sent to your email</Text>
          </div>
        )}

        {isDeclined && (
          <div className="mt-4 py-4 text-center">
            <div className="bg-kumo-danger/10 text-kumo-danger mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
              <XCircleIcon className="h-6 w-6" />
            </div>
            <div className="text-kumo-default font-sans text-sm font-semibold">
              You have declined this document
            </div>
          </div>
        )}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
