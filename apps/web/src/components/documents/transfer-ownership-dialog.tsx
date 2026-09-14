import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Select } from "@cloudflare/kumo/components/select";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangleIcon, ArrowRightLeftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useOrganizationMembers } from "@/hooks/use-organization-members";
import { transferDocument } from "@/lib/api-client";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  currentOwnerId: string;
  sharingMode: string;
  slug: string;
  organizationSlug: string;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  currentOwnerId,
  sharingMode,
  slug,
  organizationSlug,
}: TransferOwnershipDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: members } = useOrganizationMembers(slug, open);

  const transferOwnership = useMutation({
    mutationFn: (variables: { publicId: string; newOwnerId: string }) =>
      transferDocument(
        organizationSlug,
        variables.publicId,
        variables.newOwnerId
      ),
  });

  const eligibleMembers =
    members?.filter((m) => m.userId !== currentOwnerId) ?? [];
  const isPrivate = sharingMode === "private";

  const handleTransfer = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);
    try {
      await transferOwnership.mutateAsync({
        publicId: documentId,
        newOwnerId: selectedUserId,
      });
      toast.success("Document ownership transferred successfully");
      onOpenChange(false);
      setSelectedUserId("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to transfer ownership"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="sm" className="p-6">
        <div className="flex flex-col items-center">
          <div className="bg-info-surface mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <ArrowRightLeftIcon className="text-info h-6 w-6" />
          </div>
          <Dialog.Title className="text-center">
            Transfer Ownership
          </Dialog.Title>
          <Dialog.Description className="text-center">
            Transfer ownership of{" "}
            <span className="font-medium">{documentName}</span> to another
            organization member.
          </Dialog.Description>
        </div>

        <div className="space-y-4 py-2">
          <Select
            label="New owner"
            value={selectedUserId}
            onValueChange={(v) => setSelectedUserId(v ?? "")}
            placeholder="Select a member..."
          >
            {eligibleMembers.map((member) => (
              <Select.Option key={member.userId} value={member.userId}>
                <span className="font-medium">
                  {member.name ?? member.email}
                </span>
                <span className="text-muted-foreground ml-2 text-xs capitalize">
                  {member.role}
                </span>
              </Select.Option>
            ))}
          </Select>

          {isPrivate && selectedUserId && (
            <div className="border-warning/30 bg-warning-surface flex gap-2 rounded-lg border p-3">
              <AlertTriangleIcon className="text-warning mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-warning text-sm">
                This document's sharing mode is <strong>Private</strong>. After
                transfer, you will lose access to this document.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
