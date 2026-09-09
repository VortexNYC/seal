import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, ArrowRightLeftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOrganizationMembers,
  transferDocument,
} from "@/lib/api-client";

interface TransferOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  currentOwnerId: string;
  sharingMode: string;
  slug: string;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  currentOwnerId,
  sharingMode,
  slug,
}: TransferOwnershipDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: members } = useQuery({
    queryKey: ["api", "organization", slug, "members"],
    queryFn: () => getOrganizationMembers(slug),
    enabled: open,
  });

  const transferOwnership = useMutation({
    mutationFn: (variables: { publicId: string; newOwnerId: string }) =>
      transferDocument(variables.publicId, variables.newOwnerId),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-info-surface mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <ArrowRightLeftIcon className="text-info h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Transfer Ownership</DialogTitle>
          <DialogDescription className="text-center">
            Transfer ownership of{" "}
            <span className="font-medium">{documentName}</span> to another
            organization member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-owner">New owner</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="new-owner">
                <SelectValue placeholder="Select a member..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    <span className="font-medium">
                      {member.name ?? member.email}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs capitalize">
                      {member.role}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

        <DialogFooter className="gap-2 sm:gap-0">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
