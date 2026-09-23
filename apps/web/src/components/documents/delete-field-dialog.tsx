import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface DeleteFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  fieldType?: string;
}

/**
 * DeleteFieldDialog - Confirmation dialog for removing a field
 */
export function DeleteFieldDialog({
  open,
  onOpenChange,
  onConfirm,
  fieldType = "field",
}: DeleteFieldDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsDeleting(false);
    }
  }, [open]);

  const handleConfirm = () => {
    setIsDeleting(true);
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        {/* vortex-allow-color: modal/dialog scrim needs fixed black opacity for backdrop contrast. */}
        <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-150" />

        <AlertDialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 duration-150">
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-destructive/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <Trash2Icon className="text-destructive h-5 w-5" />
                </div>
                <AlertDialogPrimitive.Title className="text-foreground text-base font-semibold">
                  Remove this {fieldType}?
                </AlertDialogPrimitive.Title>
              </div>

              <AlertDialogPrimitive.Description className="text-muted-foreground text-sm">
                This action cannot be undone. The field will be permanently
                removed from your document.
              </AlertDialogPrimitive.Description>
            </div>

            <div className="bg-muted border-border/50 flex justify-end gap-3 rounded-b-lg border-t px-6 py-4">
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  className="border-border bg-card text-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </AlertDialogPrimitive.Cancel>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
