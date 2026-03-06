import { LinkIcon, MailIcon, TrashIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Separator } from "../ui/separator";

type RecipientStatus = "pending" | "viewed" | "signed" | "approved" | "declined" | "expired";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Recipient Options</DialogTitle>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold",
                recipient.status === "pending"
                  ? "bg-muted text-muted-foreground"
                  : recipient.status === "viewed"
                    ? "bg-info-surface text-info"
                    : recipient.status === "signed" || recipient.status === "approved"
                      ? "bg-success-surface text-success"
                      : recipient.status === "declined"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground",
              )}
            >
              {getInitials(recipient.name, recipient.email)}
            </div>
            <div className="min-w-0">
              {recipient.name && (
                <div className="truncate text-sm font-medium">{recipient.name}</div>
              )}
              <div
                className={cn("truncate text-xs", recipient.name ? "text-muted-foreground" : "text-sm font-medium")}
              >
                {recipient.email}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {getRoleLabel(recipient.role)} &middot;{" "}
                <span
                  className={cn(
                    "font-medium",
                    recipient.status === "pending"
                      ? "text-muted-foreground"
                      : recipient.status === "viewed"
                        ? "text-info"
                        : recipient.status === "signed" || recipient.status === "approved"
                          ? "text-success"
                          : recipient.status === "declined"
                            ? "text-destructive"
                            : "text-muted-foreground",
                  )}
                >
                  {recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close recipient options"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Options */}
        <div className="p-2">
          {hasSigningLink && (
            <button
              type="button"
              onClick={handleCopySigningLink}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
            >
              <div className="bg-info-surface text-info flex h-8 w-8 items-center justify-center rounded-md">
                <LinkIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Copy signing link</div>
                <div className="text-muted-foreground text-xs">
                  Share this link with the recipient
                </div>
              </div>
            </button>
          )}

          {canResend && onResendEmail && (
            <button
              type="button"
              onClick={handleResendEmail}
              className="hover:bg-muted flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
            >
              <div className="bg-success-surface text-success flex h-8 w-8 items-center justify-center rounded-md">
                <MailIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Resend email</div>
                <div className="text-muted-foreground text-xs">Send another notification email</div>
              </div>
            </button>
          )}

          {canEdit && onRemove && (
            <>
              {(hasSigningLink || canResend) && <Separator className="my-2" />}
              <button
                type="button"
                onClick={handleRemove}
                className="hover:bg-destructive/10 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
              >
                <div className="bg-destructive/10 text-destructive flex h-8 w-8 items-center justify-center rounded-md">
                  <TrashIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-destructive text-sm font-medium">Remove recipient</div>
                  <div className="text-muted-foreground text-xs">Remove from this document</div>
                </div>
              </button>
            </>
          )}

          {!hasSigningLink && !canResend && !canEdit && (
            <div className="text-muted-foreground p-4 text-center text-sm">
              No actions available
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
