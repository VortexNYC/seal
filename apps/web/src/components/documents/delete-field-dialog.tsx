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
        <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-150" />

        <AlertDialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 duration-150">
          <div className="rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                  <Trash2Icon className="h-5 w-5 text-red-600" />
                </div>
                <AlertDialogPrimitive.Title className="text-base font-semibold text-gray-900">
                  Remove this {fieldType}?
                </AlertDialogPrimitive.Title>
              </div>

              <AlertDialogPrimitive.Description className="text-sm text-gray-500">
                This action cannot be undone. The field will be permanently removed from your
                document.
              </AlertDialogPrimitive.Description>
            </div>

            <div className="flex justify-end gap-3 rounded-b-lg border-t border-gray-100 bg-gray-50 px-6 py-4">
              <AlertDialogPrimitive.Cancel asChild>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </AlertDialogPrimitive.Cancel>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
