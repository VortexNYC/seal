import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { useState, type ReactElement } from "react";

import { forwardDocument } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function ForwardDocumentDialog({
  open,
  onOpenChange,
  organizationSlug,
  documentId,
  documentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  documentId: string;
  documentName: string;
}): ReactElement {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setEmail("");
        onOpenChange(next);
      }}
    >
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Forward completed PDF</Dialog.Title>
        <Dialog.Description>
          Email {documentName} to someone who is not a signer. They get the
          file. They are not asked to sign.
        </Dialog.Description>
        <Input
          type="email"
          value={email}
          placeholder="name@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
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
            variant="primary"
            disabled={sending || !email.includes("@")}
            onClick={() => {
              setSending(true);
              void forwardDocument(organizationSlug, documentId, email.trim())
                .then(() => {
                  toast.success("Completed PDF sent");
                  onOpenChange(false);
                })
                .catch(() => {
                  toast.error("Could not forward the PDF");
                })
                .finally(() => setSending(false));
            }}
          >
            Send copy
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
