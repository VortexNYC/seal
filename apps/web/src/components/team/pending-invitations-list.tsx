/**
 * Pending Invitations List Component
 *
 * Displays pending invitations with option to cancel
 */

import { useAction } from "convex/react";
import { Ban, MailIcon, RefreshCw } from "lucide-react";
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
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

interface Invitation {
  id: Id<"organization_invitations">;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined" | "expired";
  invitedAt: number;
  expiresAt: number;
  inviterName: string;
  inviterEmail: string;
  clerkInvitationId?: string;
  clerkOrganizationId?: string;
}

interface PendingInvitationsListProps {
  invitations: Invitation[];
  organizationId: Id<"organizations">;
}

export function PendingInvitationsList({
  invitations,
  organizationId: _organizationId,
}: PendingInvitationsListProps) {
  const [revokingId, setRevokingId] = useState<Id<"organization_invitations"> | null>(null);
  const [resendingId, setResendingId] = useState<Id<"organization_invitations"> | null>(null);

  const revokeInvitation = useAction(api.organizations.actions.clerkRevokeInvitation);
  const resendInvitation = useAction(api.organizations.actions.clerkResendInvitation);

  const handleRevokeInvitation = async (
    invitationId: Id<"organization_invitations">,
    email: string,
    clerkInvitationId?: string,
    clerkOrganizationId?: string,
  ) => {
    if (!clerkInvitationId || !clerkOrganizationId) {
      toast.error("Cannot revoke invitation", {
        description: "This invitation is not managed by Clerk",
      });
      return;
    }

    setRevokingId(invitationId);
    try {
      await revokeInvitation({
        clerkInvitationId,
        clerkOrganizationId,
      });
      toast.success("Invitation revoked", {
        description: `The invitation for ${email} has been revoked`,
      });
    } catch (error) {
      toast.error("Failed to revoke invitation", {
        description: getErrorMessage(error),
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleResendInvitation = async (
    invitationId: Id<"organization_invitations">,
    email: string,
  ) => {
    setResendingId(invitationId);
    try {
      await resendInvitation({ invitationId });
      toast.success("Invitation resent", {
        description: `A new invitation has been sent to ${email}`,
      });
    } catch (error) {
      toast.error("Failed to resend invitation", {
        description: getErrorMessage(error),
      });
    } finally {
      setResendingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-role-admin-surface text-role-admin",
      member: "bg-role-member-surface text-role-member",
      viewer: "bg-role-viewer-surface text-role-viewer",
    };

    return (
      <Badge variant="outline" className={colors[role] || colors.member}>
        {role}
      </Badge>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isExpired = (expiresAt: number) => {
    return Date.now() > expiresAt;
  };

  // SEA-140: Enhanced empty state for invitations
  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={MailIcon}
        title="No pending invitations"
        description="All invitations have been accepted or there are no pending invitations. Use the 'Invite Member' button to add new team members."
        withCard={false}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Invited By</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => (
          <TableRow key={invitation.id}>
            <TableCell className="font-medium">{invitation.email}</TableCell>
            <TableCell>{getRoleBadge(invitation.role)}</TableCell>
            <TableCell>
              <div className="text-sm">
                <div>{invitation.inviterName}</div>
                <div className="text-muted-foreground">{invitation.inviterEmail}</div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatTimeAgo(invitation.invitedAt)}
            </TableCell>
            <TableCell>
              {isExpired(invitation.expiresAt) ? (
                <Badge variant="destructive">Expired</Badge>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {formatDate(invitation.expiresAt)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                  disabled={resendingId === invitation.id || revokingId === invitation.id}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${resendingId === invitation.id ? "animate-spin" : ""}`}
                  />
                  {resendingId === invitation.id ? "Sending..." : "Resend"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleRevokeInvitation(
                      invitation.id,
                      invitation.email,
                      invitation.clerkInvitationId,
                      invitation.clerkOrganizationId,
                    )
                  }
                  disabled={revokingId === invitation.id || resendingId === invitation.id}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {revokingId === invitation.id ? "Revoking..." : "Revoke"}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
