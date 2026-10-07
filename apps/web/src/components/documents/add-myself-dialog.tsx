import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useState, type JSX } from "react";

interface AddMyselfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
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
}: AddMyselfDialogProps): JSX.Element | null {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsConfirming(false);
    }
  }, [open]);

  const handleConfirm = (): void => {
    if (isConfirming) return;
    setIsConfirming(true);
    void (async () => {
      try {
        await onConfirm();
      } finally {
        setIsConfirming(false);
      }
    })();
  };

  const body = (
    <>
      <div className="mt-3">
        {userName ? <Text>{userName}</Text> : null}
        <Text variant="secondary">{userEmail}</Text>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={handleConfirm}
          disabled={isConfirming || !userEmail}
        >
          {isConfirming ? "Adding..." : "Add as signer"}
        </Button>
      </div>
    </>
  );

  if (!open) return null;

  return (
      <div data-testid="add-myself-panel" className="flex flex-col gap-2">
        <span title="Back to recipients" className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
        </span>
        <div>
          <Text as="p" size="sm" bold>
            Add yourself as a signer
          </Text>
          <Text as="p" variant="secondary" size="xs">
            You will be added as a signer on this document.
          </Text>
        </div>
        {body}
      </div>
  );
}
