/**
 * Manage Member Dialog Component
 *
 * Dialog for managing member role and status
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";

interface Member {
	id: Id<"organization_members">;
	userId: Id<"users">;
	name: string | null;
	email: string;
	avatarUrl: string | null;
	role: "system" | "owner" | "admin" | "member" | "viewer";
	status: "active" | "inactive" | "suspended" | "pending" | "blocked";
	isPrimary: boolean;
	joinedAt: number;
}

interface ManageMemberDialogProps {
	member: Member;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ManageMemberDialog({
	member,
	open,
	onOpenChange,
}: ManageMemberDialogProps) {
	const [role, setRole] = useState<"admin" | "member" | "viewer">(
		member.role === "owner" || member.role === "system" ? "admin" : member.role
	);
	const [status, setStatus] = useState<
		"active" | "inactive" | "suspended" | "pending"
	>(
		member.status === "blocked"
			? "suspended"
			: (member.status as "active" | "inactive" | "suspended" | "pending")
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const updateMemberRole = useMutation(
		api.organizations.mutations.updateMemberRole
	);
	const updateMemberStatus = useMutation(
		api.organizations.mutations.updateMemberStatus
	);
	const suspendMember = useMutation(api.organizations.mutations.suspendMember);
	const reactivateMember = useMutation(
		api.organizations.mutations.reactivateMember
	);
	const removeMember = useMutation(api.organizations.mutations.removeMember);

	const getInitials = (name: string | null, email: string) => {
		if (name) {
			return name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}
		return email.slice(0, 2).toUpperCase();
	};

	const handleSave = async () => {
		setIsSubmitting(true);

		try {
			// Update role if changed
			if (role !== member.role) {
				await updateMemberRole({
					memberId: member.id,
					role,
				});
			}

			// Update status if changed
			if (status !== member.status) {
				await updateMemberStatus({
					memberId: member.id,
					status,
				});
			}

			toast.success("Member updated", {
				description: "Member role and status have been updated successfully",
			});

			onOpenChange(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to update member";
			toast.error("Failed to update member", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSuspend = async () => {
		setIsSubmitting(true);

		try {
			await suspendMember({
				memberId: member.id,
			});

			toast.success("Member suspended", {
				description: `${member.name || member.email} has been suspended`,
			});

			onOpenChange(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to suspend member";
			toast.error("Failed to suspend member", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReactivate = async () => {
		setIsSubmitting(true);

		try {
			await reactivateMember({
				memberId: member.id,
			});

			toast.success("Member reactivated", {
				description: `${member.name || member.email} has been reactivated`,
			});

			onOpenChange(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to reactivate member";
			toast.error("Failed to reactivate member", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRemove = async () => {
		if (
			!confirm(
				`Are you sure you want to remove ${member.name || member.email} from this workspace?`
			)
		) {
			return;
		}

		setIsSubmitting(true);

		try {
			await removeMember({
				memberId: member.id,
			});

			toast.success("Member removed", {
				description: `${member.name || member.email} has been removed from the workspace`,
			});

			onOpenChange(false);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to remove member";
			toast.error("Failed to remove member", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Manage Member</DialogTitle>
					<DialogDescription>
						Update member role, status, or remove from workspace
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Member Info */}
					<div className="flex items-center gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src={member.avatarUrl ?? undefined} />
							<AvatarFallback>
								{getInitials(member.name, member.email)}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1">
							<div className="font-medium">{member.name || "Unknown"}</div>
							<div className="text-sm text-muted-foreground">{member.email}</div>
						</div>
						<Badge
							variant={
								member.status === "active"
									? "default"
									: member.status === "suspended"
										? "destructive"
										: "secondary"
							}
						>
							{member.status}
						</Badge>
					</div>

					<Separator />

					{/* Role Selection */}
					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Select
							value={role}
							onValueChange={(value) =>
								setRole(value as "admin" | "member" | "viewer")
							}
							disabled={isSubmitting || member.role === "owner"}
						>
							<SelectTrigger id="role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="viewer">
									<div className="flex flex-col items-start">
										<span className="font-medium">Viewer</span>
										<span className="text-xs text-muted-foreground">
											Can view documents and signatures
										</span>
									</div>
								</SelectItem>
								<SelectItem value="member">
									<div className="flex flex-col items-start">
										<span className="font-medium">Member</span>
										<span className="text-xs text-muted-foreground">
											Can create and send documents
										</span>
									</div>
								</SelectItem>
								<SelectItem value="admin">
									<div className="flex flex-col items-start">
										<span className="font-medium">Admin</span>
										<span className="text-xs text-muted-foreground">
											Can manage team and settings
										</span>
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
						{member.role === "owner" && (
							<p className="text-xs text-muted-foreground">
								Owner role cannot be changed
							</p>
						)}
					</div>

					{/* Status Selection */}
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<Select
							value={status}
							onValueChange={(value) =>
								setStatus(
									value as "active" | "inactive" | "suspended" | "pending"
								)
							}
							disabled={isSubmitting || member.role === "owner"}
						>
							<SelectTrigger id="status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
								<SelectItem value="suspended">Suspended</SelectItem>
								<SelectItem value="pending">Pending</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<Separator />

					{/* Quick Actions */}
					<div className="space-y-2">
						<Label>Quick Actions</Label>
						<div className="flex flex-wrap gap-2">
							{member.status !== "suspended" && member.role !== "owner" && (
								<Button
									size="sm"
									variant="outline"
									onClick={handleSuspend}
									disabled={isSubmitting}
								>
									Suspend Member
								</Button>
							)}
							{(member.status === "suspended" || member.status === "inactive") &&
								member.role !== "owner" && (
									<Button
										size="sm"
										variant="outline"
										onClick={handleReactivate}
										disabled={isSubmitting}
									>
										Reactivate Member
									</Button>
								)}
							{member.role !== "owner" && (
								<Button
									size="sm"
									variant="destructive"
									onClick={handleRemove}
									disabled={isSubmitting}
								>
									Remove from Workspace
								</Button>
							)}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isSubmitting}>
						{isSubmitting ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
