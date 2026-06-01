/**
 * Pending Invitations List Component
 *
 * Displays pending invitations (vortexAuth component) with option to revoke.
 */

import { api } from "@seal/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Ban, MailIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/utils";

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
  status: string;
  createdAt: number;
  expiresAt: number;
}

interface PendingInvitationsListProps {
  invitations: Invitation[];
}

export function PendingInvitationsList({ invitations }: PendingInvitationsListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const revokeInvitation = useMutation(api.invitations.revokeInvitation);

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    setRevokingId(invitationId);
    try {
      await revokeInvitation({ invitationId });
      toast.success("Invitation revoked", {
        description: `The invitation for ${email} has been revoked`,
      });
    } catch (error) {
      toast.error("Failed to revoke invitation", { description: getErrorMessage(error) });
    } finally {
      setRevokingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={MailIcon}
        title="No pending invitations"
        description="Invitations you send will appear here until they're accepted."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => (
          <TableRow key={invitation.id}>
            <TableCell className="font-medium">{invitation.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{invitation.role}</Badge>
            </TableCell>
            <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                disabled={revokingId === invitation.id}
                onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
              >
                <Ban className="mr-1 h-4 w-4" />
                {revokingId === invitation.id ? "Revoking..." : "Revoke"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
