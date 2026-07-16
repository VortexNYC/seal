import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface AddMyselfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  userEmail?: string;
  userName?: string;
}

/**
 * AddMyselfDialog - Confirmation dialog for adding yourself as a signer
 */
export function AddMyselfDialog({
  open,
  onOpenChange,
  onConfirm,
  userEmail,
  userName,
}: AddMyselfDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsConfirming(false);
    }
  }, [open]);

  const handleConfirm = () => {
    setIsConfirming(true);
    onConfirm();
  };

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        {/* vortex-allow-color: modal/dialog scrim needs fixed black opacity for backdrop contrast. */}
        <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-150" />

        <AlertDialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 -translate-y-1/2 duration-150">
          <div className="bg-card rounded-lg border shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-info-surface flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <UserIcon className="text-info h-5 w-5" />
                </div>
                <AlertDialogPrimitive.Title className="text-foreground text-base font-semibold">
                  Add yourself as a signer?
                </AlertDialogPrimitive.Title>
              </div>

              <AlertDialogPrimitive.Description className="text-muted-foreground text-sm">
                You will be added as a signer to this document.
              </AlertDialogPrimitive.Description>

              <div className="bg-muted border-border/50 mt-3 rounded-md border px-3 py-2">
                {userName && <div className="text-foreground text-sm font-medium">{userName}</div>}
                <div className="text-muted-foreground text-sm">{userEmail}</div>
              </div>
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
                disabled={isConfirming}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirming ? "Adding..." : "Add as signer"}
              </button>
            </div>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
