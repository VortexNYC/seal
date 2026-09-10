import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  PenLineIcon,
  XCircleIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

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
}: InAppSigningSectionProps) {
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

  const getStatusConfig = () => {
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

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      className="border-warning/30 bg-warning-surface/50 overflow-hidden rounded-2xl border-2 shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-expanded={isOpen}
          className="hover:bg-warning-surface/80 flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg",
                statusConfig.bgColor,
                statusConfig.textColor
              )}
            >
              <PenLineIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <div className="text-left">
              <span className="text-foreground block font-sans text-[0.9375rem] font-semibold sm:text-sm">
                Your Signature
              </span>
              <span
                className={cn(
                  "flex items-center gap-1 font-sans text-xs",
                  statusConfig.textColor
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </span>
            </div>
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent
        id="in-app-signing-content"
        className="border-warning/20 border-t px-5 pb-5 sm:px-4 sm:pb-4"
      >
        {canSign && fields.length > 0 && (
          <div className="mt-4 mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground font-sans text-xs font-medium">
                Progress
              </span>
              <span
                className="text-muted-foreground font-sans text-xs"
                aria-live="polite"
              >
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
            <p className="text-muted-foreground text-sm">
              In-app signing is being migrated to the Cloudflare Worker
              backend. For now, recipients sign through the secure public
              signing link.
            </p>
            <Button
              disabled
              className="h-11 w-full text-sm font-medium"
              type="button"
            >
              <PenLineIcon className="mr-2 h-4 w-4" />
              Signing temporarily unavailable
            </Button>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
