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
          <div className="rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                  <UserXIcon className="h-5 w-5 text-red-600" />
                </div>
                <AlertDialogPrimitive.Title className="text-base font-semibold text-gray-900">
                  Remove recipient?
                </AlertDialogPrimitive.Title>
              </div>

              <AlertDialogPrimitive.Description className="text-sm text-gray-500">
                This recipient will no longer have access to this document.
              </AlertDialogPrimitive.Description>

              <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                {recipientName && (
                  <div className="text-sm font-medium text-gray-900">{recipientName}</div>
                )}
                <div className="text-sm text-gray-500">{recipientEmail}</div>
                {recipientRole && (
                  <div className="mt-1 text-xs text-gray-400">{formatRole(recipientRole)}</div>
                )}
              </div>

              {hasFields && (
                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="text-sm font-medium text-amber-800">
                      {fieldCount} {fieldCount === 1 ? "field" : "fields"} will be deleted
                    </div>
                    <div className="mt-0.5 text-xs text-amber-700">
                      All fields assigned to this recipient will be permanently removed from the
                      document.
                    </div>
                  </div>
                </div>
              )}
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
                disabled={isRemoving}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
