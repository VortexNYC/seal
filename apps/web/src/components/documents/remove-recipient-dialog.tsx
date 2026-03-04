import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangleIcon, UserXIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface RemoveRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipientEmail?: string;
  recipientName?: string;
  recipientRole?: string;
  fieldCount?: number;
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
}: RemoveRecipientDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsRemoving(false);
    }
  }, [open]);

  const handleConfirm = () => {
    setIsRemoving(true);
    onConfirm();
  };

  const formatRole = (role?: string) => {
    if (!role) return "";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const hasFields = fieldCount > 0;

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-150" />

        <AlertDialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 duration-150">
          <div className="bg-card border-border rounded-lg border shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-destructive/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <UserXIcon className="text-destructive h-5 w-5" />
                </div>
                <AlertDialogPrimitive.Title className="text-foreground text-base font-semibold">
                  Remove recipient?
                </AlertDialogPrimitive.Title>
              </div>

              <AlertDialogPrimitive.Description className="text-muted-foreground text-sm">
                This recipient will no longer have access to this document.
              </AlertDialogPrimitive.Description>

              <div className="bg-muted border-border mt-3 rounded-md border px-3 py-2">
                {recipientName && (
                  <div className="text-foreground text-sm font-medium">{recipientName}</div>
                )}
                <div className="text-muted-foreground text-sm">{recipientEmail}</div>
                {recipientRole && (
                  <div className="text-muted-foreground mt-1 text-xs">{formatRole(recipientRole)}</div>
                )}
              </div>

              {hasFields && (
                <div className="bg-warning-surface border-warning/30 mt-3 flex items-start gap-2.5 rounded-md border p-3">
                  <AlertTriangleIcon className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-warning text-sm font-medium">
                      {fieldCount} {fieldCount === 1 ? "field" : "fields"} will be deleted
                    </div>
                    <div className="text-warning mt-0.5 text-xs opacity-80">
                      All fields assigned to this recipient will be permanently removed from the
                      document.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-muted border-border flex justify-end gap-3 rounded-b-lg border-t px-6 py-4">
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  className="border-border text-foreground hover:bg-muted/80 rounded-md border bg-transparent px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </AlertDialogPrimitive.Cancel>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isRemoving}
                className="bg-destructive hover:bg-destructive/90 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRemoving ? "Removing..." : hasFields ? "Remove with fields" : "Remove"}
              </button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
