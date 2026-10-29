import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { useRouter } from "@tanstack/react-router";
import { useState, type ReactElement } from "react";

import { forwardDocument, forwardEnvelope } from "@/lib/api-client";
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const busy = sending || starting;

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
          Email {documentName}, or start a new envelope from the executed file.
          A new envelope has no signers yet.
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
            variant="outline"
            disabled={busy || !email.includes("@")}
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
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => {
              setStarting(true);
              void forwardEnvelope(organizationSlug, documentId)
                .then((created) => {
                  toast.success("New envelope started");
                  onOpenChange(false);
                  void router.navigate({
                    to: "/$slug/documents/$documentId",
                    params: {
                      slug: organizationSlug,
                      documentId: created.publicId,
                    },
                  });
                })
                .catch(() => {
                  toast.error("Could not start a new envelope");
                })
                .finally(() => setStarting(false));
            }}
          >
            New envelope
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
