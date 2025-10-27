/**
 * Pending Invitations List Component
 *
 * Displays pending invitations with option to cancel
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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
	const [revokingId, setRevokingId] =
		useState<Id<"organization_invitations"> | null>(null);

	const revokeInvitation = useAction(
		api.organizations.actions.clerkRevokeInvitation,
	);

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
			const errorMessage =
				error instanceof Error ? error.message : "Failed to revoke invitation";
			toast.error("Failed to revoke invitation", {
				description: errorMessage,
			});
		} finally {
			setRevokingId(null);
		}
	};

	const getRoleBadge = (role: string) => {
		const colors: Record<string, string> = {
			admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			member:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
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

	if (invitations.length === 0) {
		return (
			<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
				No pending invitations
			</div>
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
								<div className="text-muted-foreground">
									{invitation.inviterEmail}
								</div>
							</div>
						</TableCell>
						<TableCell className="text-sm text-muted-foreground">
							{formatTimeAgo(invitation.invitedAt)}
						</TableCell>
						<TableCell>
							{isExpired(invitation.expiresAt) ? (
								<Badge variant="destructive">Expired</Badge>
							) : (
								<span className="text-sm text-muted-foreground">
									{formatDate(invitation.expiresAt)}
								</span>
							)}
						</TableCell>
						<TableCell className="text-right">
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
								disabled={revokingId === invitation.id}
							>
								<Ban className="mr-2 h-4 w-4" />
								{revokingId === invitation.id ? "Revoking..." : "Revoke"}
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
