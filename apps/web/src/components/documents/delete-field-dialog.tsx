import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { useEffect, useState, type JSX } from "react";

import { RailBack } from "./rail-back";

interface DeleteFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  fieldType?: string;
  presentation?: "dialog" | "panel";
}

/**
 * DeleteFieldDialog - Confirmation dialog for removing a field
 */
export function DeleteFieldDialog({
  open,
  onOpenChange,
  onConfirm,
  fieldType = "field",
  presentation = "dialog",
}: DeleteFieldDialogProps): JSX.Element | null {
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsDeleting(false);
    }
  }, [open]);

  const handleConfirm = (): void => {
    setIsDeleting(true);
    onConfirm();
    onOpenChange(false);
  };

  const actions = (
    <div className="mt-4 flex flex-col gap-2">
      <Button
        type="button"
        variant="destructive"
        className="w-full"
        onClick={handleConfirm}
        disabled={isDeleting}
      >
        {isDeleting ? "Removing..." : "Remove"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onOpenChange(false)}
        disabled={isDeleting}
      >
        Cancel
      </Button>
    </div>
  );

  if (presentation === "panel") {
    if (!open) return null;
    return (
      <div data-testid="delete-field-panel" className="flex flex-col gap-2">
        <RailBack onBack={() => onOpenChange(false)} tip="Back to the fields" />
        <Text as="p" size="sm" bold>
          Remove this {fieldType}?
        </Text>
        <Text as="p" variant="secondary" size="xs">
          The field will be removed from this document.
        </Text>
        {actions}
      </div>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} role="alertdialog">
      <Dialog className="p-6">
        <Dialog.Title>Remove this {fieldType}?</Dialog.Title>
        <Dialog.Description>
          The field will be removed from this document.
        </Dialog.Description>
        {actions}
      </Dialog>
    </Dialog.Root>
  );
}
