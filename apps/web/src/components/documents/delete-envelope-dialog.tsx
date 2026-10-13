import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { useState, type ReactElement } from "react";

export function DeleteEnvelopeDialog({
  open,
  onOpenChange,
  documentName,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  onDelete: () => Promise<void>;
}): ReactElement {
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Delete envelope</Dialog.Title>
        <Dialog.Description>
          {documentName} leaves the documents list. This does not unsend a copy
          someone already downloaded.
        </Dialog.Description>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              void onDelete().finally(() => setDeleting(false));
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
