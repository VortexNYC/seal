import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { EnvelopeSimple, Link, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { type Id } from "@/lib/ids";
import { cn } from "@/lib/utils";

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
    (recipient.status === "pending" ||
      recipient.status === "viewed" ||
      recipient.status === "expired");

  const hasSigningLink = !!recipient.signingToken;

  const statusColorClasses = (status: RecipientStatus) =>
    cn(
      "font-medium",
      status === "pending" || status === "expired"
        ? "text-kumo-secondary"
        : status === "viewed"
          ? "text-kumo-info"
          : status === "signed" || status === "approved"
            ? "text-kumo-success"
            : status === "declined"
              ? "text-kumo-danger"
              : "text-kumo-secondary"
    );

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog size="sm" className="gap-0 overflow-hidden p-0">
        <Dialog.Title className="sr-only">Recipient Options</Dialog.Title>

        {/* Header */}
        <div className="border-kumo-hairline flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold",
                recipient.status === "pending" || recipient.status === "expired"
                  ? "bg-kumo-elevated text-kumo-secondary"
                  : recipient.status === "viewed"
                    ? "bg-kumo-info-tint text-kumo-info"
                    : recipient.status === "signed" ||
                        recipient.status === "approved"
                      ? "bg-kumo-success-tint text-kumo-success"
                      : recipient.status === "declined"
                        ? "bg-kumo-danger/10 text-kumo-danger"
                        : "bg-kumo-elevated text-kumo-secondary"
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
                  variant="secondary"
                  DANGEROUS_className={statusColorClasses(recipient.status)}
                >
                  {recipient.status.charAt(0).toUpperCase() +
                    recipient.status.slice(1)}
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
            <button
              type="button"
              onClick={handleCopySigningLink}
              className="hover:bg-kumo-elevated flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
            >
              <div className="bg-kumo-info-tint text-kumo-info flex h-8 w-8 items-center justify-center rounded-md">
                <Link className="size-4" />
              </div>
              <div>
                <Text as="p" size="sm" variant="body">
                  Copy signing link
                </Text>
                <Text as="p" size="xs" variant="secondary">
                  Share this link with the recipient
                </Text>
              </div>
            </button>
          )}

          {canResend && onResendEmail && (
            <button
              type="button"
              onClick={handleResendEmail}
              className="hover:bg-kumo-elevated flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
            >
              <div className="bg-kumo-success-tint text-kumo-success flex h-8 w-8 items-center justify-center rounded-md">
                <EnvelopeSimple className="size-4" />
              </div>
              <div>
                <Text as="p" size="sm" variant="body">
                  Resend email
                </Text>
                <Text as="p" size="xs" variant="secondary">
                  Send another notification email
                </Text>
              </div>
            </button>
          )}

          {canEdit && onRemove && (
            <>
              {(hasSigningLink || canResend) && (
                <div className="border-kumo-hairline my-2 border-t" />
              )}
              <button
                type="button"
                onClick={handleRemove}
                className="hover:bg-kumo-danger/10 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
              >
                <div className="bg-kumo-danger/10 text-kumo-danger flex h-8 w-8 items-center justify-center rounded-md">
                  <Trash className="size-4" />
                </div>
                <div>
                  <Text
                    as="p"
                    size="sm"
                    variant="body"
                    DANGEROUS_className="text-kumo-danger"
                  >
                    Remove recipient
                  </Text>
                  <Text as="p" size="xs" variant="secondary">
                    Remove from this document
                  </Text>
                </div>
              </button>
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
      </Dialog>
    </Dialog.Root>
  );
}
