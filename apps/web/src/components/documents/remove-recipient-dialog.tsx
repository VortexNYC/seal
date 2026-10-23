import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { useEffect, useState, type JSX } from "react";

import { RailBack } from "./rail-back";

interface RemoveRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipientEmail?: string;
  recipientName?: string;
  recipientRole?: string;
  fieldCount?: number;
  presentation?: "dialog" | "panel";
}

function formatRole(role?: string): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * RemoveRecipientDialog - Confirmation dialog for removing a recipient
 */
export function RemoveRecipientDialog({
  open,
  onOpenChange,
  onConfirm,
  recipientEmail,
  recipientName,
  recipientRole,
  fieldCount = 0,
  presentation = "dialog",
}: RemoveRecipientDialogProps): JSX.Element | null {
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsRemoving(false);
    }
  }, [open]);

  const handleConfirm = (): void => {
    setIsRemoving(true);
    onConfirm();
  };

  const hasFields = fieldCount > 0;

  const details = (
    <>
        <div className="mt-3">
          {recipientName ? <Text>{recipientName}</Text> : null}
          <Text variant="secondary">{recipientEmail}</Text>
          {recipientRole ? (
            <Text variant="secondary" size="xs">
              {formatRole(recipientRole)}
            </Text>
          ) : null}
        </div>
        {hasFields ? (
          <Text variant="error" size="sm" DANGEROUS_className="mt-3">
            {fieldCount} {fieldCount === 1 ? "field" : "fields"} assigned to
            this recipient will be permanently removed.
          </Text>
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={handleConfirm}
            disabled={isRemoving}
          >
            {isRemoving
              ? "Removing..."
              : hasFields
                ? "Remove with fields"
                : "Remove"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={isRemoving}
          >
            Cancel
          </Button>
        </div>
    </>
  );

  if (presentation === "panel") {
    if (!open) return null;
    return (
      <div data-testid="remove-recipient-panel" className="flex flex-col gap-2">
        <RailBack onBack={() => onOpenChange(false)} tip="Back to recipients" />
        <Text as="p" size="sm" bold>
          Remove recipient?
        </Text>
        <Text as="p" variant="secondary" size="xs">
          This recipient will no longer have access to this document.
        </Text>
        {details}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} role="alertdialog">
      <Dialog className="p-6">
        <Dialog.Title>Remove recipient?</Dialog.Title>
        <Dialog.Description>
          This recipient will no longer have access to this document.
        </Dialog.Description>
        {details}
      </Dialog>
    </Dialog.Root>
  );
}
