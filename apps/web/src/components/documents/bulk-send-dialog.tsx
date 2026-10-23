import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";

import { bulkSendDocuments, getDocuments } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function BulkSendDialog({
  open,
  onOpenChange,
  organizationSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
}): ReactElement {
  const queryClient = useQueryClient();
  const drafts = useQuery({
    queryKey: ["documents", organizationSlug, "drafts"],
    queryFn: () => getDocuments(organizationSlug, { workflowStatus: "draft" }),
    enabled: open,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected(new Set());
        onOpenChange(next);
      }}
    >
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Bulk send</Dialog.Title>
        <Dialog.Description>
          Each selected draft is sent to the people already on it.
        </Dialog.Description>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {drafts.data?.length ? (
            drafts.data.map((document) => (
              <Checkbox
                key={document.publicId}
                checked={selected.has(document.publicId)}
                label={document.name}
                onCheckedChange={(checked) => {
                  setSelected((current) => {
                    const next = new Set(current);
                    if (checked === true) next.add(document.publicId);
                    else next.delete(document.publicId);
                    return next;
                  });
                }}
              />
            ))
          ) : (
            <Text as="p" variant="secondary" size="sm">
              {drafts.isLoading ? "Loading drafts…" : "No drafts to send."}
            </Text>
          )}
        </div>
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
            disabled={sending || selected.size === 0}
            onClick={() => {
              setSending(true);
              void bulkSendDocuments(organizationSlug, [...selected])
                .then((result) => {
                  if (result.failed === 0) {
                    toast.success(
                      result.succeeded === 1
                        ? "Draft sent"
                        : `${result.succeeded} drafts sent`
                    );
                  } else {
                    toast.error(
                      `${result.succeeded} sent, ${result.failed} could not be sent`
                    );
                  }
                  void queryClient.invalidateQueries({
                    queryKey: ["documents", organizationSlug],
                  });
                  onOpenChange(false);
                })
                .catch(() => {
                  toast.error("Could not send the drafts");
                })
                .finally(() => setSending(false));
            }}
          >
            Send selected
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
