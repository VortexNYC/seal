import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { EnvelopeSimple, Link, Trash, X } from "@phosphor-icons/react";

import {
  recipientFacingStatus,
  recipientMarkClass,
  toWorkflowStatus,
} from "@/lib/document-status";
import { type Id } from "@/lib/ids";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { RailBack } from "./rail-back";

type RecipientStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "approved"
  | "declined"
  | "expired";

type RecipientRole = "signer" | "viewer" | "approver";

interface Recipient {
  _id: Id<"document_recipients">;
  email: string;
  name?: string;
  role: RecipientRole;
  status: RecipientStatus;
  signingToken?: string;
}

interface RecipientOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Recipient | null;
  documentStatus?: string;
  canEdit: boolean;
  onResendEmail?: (recipientId: Id<"document_recipients">) => void;
  onRemove?: (recipient: Recipient) => void;
  presentation?: "dialog" | "panel";
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
}

function getRoleLabel(role: RecipientRole): string {
  switch (role) {
    case "signer":
      return "Signer";
    case "viewer":
      return "Viewer";
    case "approver":
      return "Approver";
    default:
      return role;
  }
}

export function RecipientOptionsDialog({
  open,
  onOpenChange,
  recipient,
  documentStatus,
  canEdit,
  onResendEmail,
  onRemove,
  presentation = "dialog",
}: RecipientOptionsDialogProps) {
  if (!recipient) return null;

  const handleCopySigningLink = () => {
    if (!recipient.signingToken) {
      toast.error("Signing link not available");
      return;
    }

    const signingUrl = `${window.location.origin}/sign/${recipient.signingToken}`;

    navigator.clipboard
      .writeText(signingUrl)
      .then(() => {
        toast.success("Signing link copied to clipboard!");
        onOpenChange(false);
      })
      .catch(() => {
        toast.error("Failed to copy link");
      });
  };

  const handleResendEmail = () => {
    onResendEmail?.(recipient._id);
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove?.(recipient);
    onOpenChange(false);
  };

  const canResend =
    documentStatus !== "draft" &&
    documentStatus !== "cancelled" &&
    documentStatus !== "completed" &&
    documentStatus !== "voided" &&
    (recipient.status === "pending" ||
      recipient.status === "viewed" ||
      recipient.status === "expired" ||
      recipient.status === "declined");

  const hasSigningLink = !!recipient.signingToken;
  const shownStatus = recipientFacingStatus(
    documentStatus ? toWorkflowStatus(documentStatus) : undefined,
    recipient.status
  );

  const statusVariant = (
    status: RecipientStatus
  ): "secondary" | "error" => {
    if (status === "declined") return "error";
    return "secondary";
  };

  const optionsBody = (
    <>

        {/* Header */}
        <div className="border-kumo-hairline flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold",
                recipientMarkClass(shownStatus)
              )}
            >
              {getInitials(recipient.name, recipient.email)}
            </div>
            <div className="min-w-0">
              {recipient.name && (
                <Text
                  as="p"
                  size="sm"
                  variant="body"
                  DANGEROUS_className="truncate"
                >
                  {recipient.name}
                </Text>
              )}
              <div
                className={cn(
                  "truncate",
                  recipient.name ? "text-xs" : "text-sm font-medium"
                )}
              >
                <Text
                  as="p"
                  size={recipient.name ? "xs" : "sm"}
                  variant="secondary"
                  DANGEROUS_className="truncate"
                >
                  {recipient.email}
                </Text>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs">
                <Text as="span" size="xs" variant="secondary">
                  {getRoleLabel(recipient.role)} &middot;{" "}
                </Text>
                <Text
                  as="span"
                  size="xs"
                  variant={
                    shownStatus === "voided"
                      ? "secondary"
                      : statusVariant(recipient.status)
                  }
                >
                  {shownStatus.charAt(0).toUpperCase() + shownStatus.slice(1)}
                </Text>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            icon={X}
            aria-label="Close recipient options"
            onClick={() => onOpenChange(false)}
          />
        </div>

        {/* Options */}
        <div className="p-2">
          {hasSigningLink && (
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start"
              icon={Link}
              onClick={handleCopySigningLink}
            >
              <span className="flex flex-col items-start">
                <Text as="span" size="sm">
                  Copy signing link
                </Text>
                <Text as="span" size="xs" variant="secondary">
                  Share this link with the recipient
                </Text>
              </span>
            </Button>
          )}

          {canResend && onResendEmail && (
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start"
              icon={EnvelopeSimple}
              onClick={handleResendEmail}
            >
              <span className="flex flex-col items-start">
                <Text as="span" size="sm">
                  Resend email
                </Text>
                <Text as="span" size="xs" variant="secondary">
                  Send another notification email
                </Text>
              </span>
            </Button>
          )}

          {canEdit && onRemove && (
            <>
              {(hasSigningLink || canResend) && (
                <div className="border-kumo-hairline my-2 border-t" />
              )}
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start"
                icon={Trash}
                onClick={handleRemove}
              >
                <span className="flex flex-col items-start">
                  <Text as="span" size="sm" variant="error">
                    Remove recipient
                  </Text>
                  <Text as="span" size="xs" variant="secondary">
                    Remove from this document
                  </Text>
                </span>
              </Button>
            </>
          )}

          {!hasSigningLink && !canResend && !canEdit && (
            <div className="p-4 text-center">
              <Text as="p" size="sm" variant="secondary">
                No actions available
              </Text>
            </div>
          )}
        </div>
    </>
  );

  if (!recipient || !open) return null;

  if (presentation === "panel") {
    return (
      <div data-testid="recipient-options-panel" className="flex flex-col gap-2">
        <RailBack onBack={() => onOpenChange(false)} tip="Back to recipients" />
        {optionsBody}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog size="sm" className="gap-0 overflow-hidden p-0">
        <Dialog.Title className="sr-only">Recipient Options</Dialog.Title>
        {optionsBody}
      </Dialog>
    </Dialog.Root>
  );
}
