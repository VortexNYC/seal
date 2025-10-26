import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface ShareDialogProps {
	documentId: Id<"documents">;
	organizationId: Id<"organizations">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

type SharingMode = "private" | "workspace" | "specific";
type PermissionLevel = "view" | "edit" | "manage";

export function ShareDialog({
	documentId,
	organizationId,
	open,
	onOpenChange,
	onSuccess,
}: ShareDialogProps) {
	const [sharingMode, setSharingMode] = useState<SharingMode>("private");
	const [selectedUserId, setSelectedUserId] = useState<string>("");
	const [permissionLevel, setPermissionLevel] =
		useState<PermissionLevel>("view");

	// Get document
	const { data: document } = useSuspenseQuery(
		convexQuery(api.documents.queries.getDocument, { documentId }),
	);

	// Get access list
	const { data: accessList, refetch: refetchAccess } = useSuspenseQuery(
		convexQuery(api.documents.queries.getDocumentAccessList, { documentId }),
	);

	// Get organization members
	const { data: members } = useSuspenseQuery(
		convexQuery(api.organizations.queries.getOrganizationMembers, {
			organizationId,
		}),
	);

	// Update sharing mode mutation
	const updateModeMutation = useMutation({
		mutationFn: async (mode: SharingMode) => {
			await convexQuery(api.documents.sharing.updateSharingMode, {
				documentId,
				sharingMode: mode,
			});
		},
		onSuccess: () => {
			toast.success("Sharing mode updated");
			refetchAccess();
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Failed to update sharing: ${error.message}`);
		},
	});

	// Grant access mutation
	const grantAccessMutation = useMutation({
		mutationFn: async () => {
			if (!selectedUserId) {
				throw new Error("Please select a user");
			}

			await convexQuery(api.documents.sharing.grantAccess, {
				documentId,
				userId: selectedUserId as Id<"users">,
				permissionLevel,
			});
		},
		onSuccess: () => {
			toast.success("Access granted");
			setSelectedUserId("");
			setPermissionLevel("view");
			refetchAccess();
		},
		onError: (error: Error) => {
			toast.error(`Failed to grant access: ${error.message}`);
		},
	});

	// Revoke access mutation
	const revokeAccessMutation = useMutation({
		mutationFn: async (userId: Id<"users">) => {
			await convexQuery(api.documents.sharing.revokeAccess, {
				documentId,
				userId,
			});
		},
		onSuccess: () => {
			toast.success("Access revoked");
			refetchAccess();
		},
		onError: (error: Error) => {
			toast.error(`Failed to revoke access: ${error.message}`);
		},
	});

	const handleSharingModeChange = (mode: SharingMode) => {
		setSharingMode(mode);
		updateModeMutation.mutate(mode);
	};

	// Filter out users who already have access
	const availableMembers = members?.filter(
		(member) =>
			member.userId !== document.ownerId &&
			!accessList.specificAccess.some(
				(access) => access.userId === member.userId,
			),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>Share Document</DialogTitle>
					<DialogDescription>
						Control who can access this document and what they can do
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Sharing Mode */}
					<div className="space-y-2">
						<Label>Sharing Mode</Label>
						<Select
							value={sharingMode}
							onValueChange={(value) =>
								handleSharingModeChange(value as SharingMode)
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="private">
									Private - Only you can access
								</SelectItem>
								<SelectItem value="workspace">
									Team - All team members can access (Pro)
								</SelectItem>
								<SelectItem value="specific">
									Specific Users - Choose who can access (Pro)
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-sm text-muted-foreground">
							{sharingMode === "private" &&
								"Only you can view and edit this document"}
							{sharingMode === "workspace" &&
								"All team members will have access"}
							{sharingMode === "specific" &&
								"Only selected users will have access"}
						</p>
					</div>

					{/* Grant Access (only for specific mode) */}
					{sharingMode === "specific" && (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Add People</Label>
								<div className="flex gap-2">
									<Select
										value={selectedUserId}
										onValueChange={setSelectedUserId}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="Select a team member..." />
										</SelectTrigger>
										<SelectContent>
											{availableMembers?.map((member) => (
												<SelectItem key={member.userId} value={member.userId}>
													{member.name} ({member.email})
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={permissionLevel}
										onValueChange={(v) =>
											setPermissionLevel(v as PermissionLevel)
										}
									>
										<SelectTrigger className="w-[140px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="view">Can View</SelectItem>
											<SelectItem value="edit">Can Edit</SelectItem>
											<SelectItem value="manage">Can Manage</SelectItem>
										</SelectContent>
									</Select>
									<Button
										onClick={() => grantAccessMutation.mutate()}
										disabled={!selectedUserId || grantAccessMutation.isPending}
									>
										Add
									</Button>
								</div>
							</div>

							{/* Access List */}
							{accessList.specificAccess.length > 0 && (
								<div className="space-y-2">
									<Label>People with Access</Label>
									<div className="border rounded-md divide-y">
										{accessList.specificAccess.map((access) => (
											<div
												key={access._id}
												className="flex items-center justify-between p-3"
											>
												<div className="flex-1">
													<p className="font-medium">{access.user?.name}</p>
													<p className="text-sm text-muted-foreground">
														{access.user?.email}
													</p>
												</div>
												<div className="flex items-center gap-2">
													<Badge variant="secondary">
														{access.permissionLevel === "view" && "Can View"}
														{access.permissionLevel === "edit" && "Can Edit"}
														{access.permissionLevel === "manage" &&
															"Can Manage"}
													</Badge>
													<Button
														variant="ghost"
														size="icon"
														onClick={() =>
															revokeAccessMutation.mutate(access.userId)
														}
														disabled={revokeAccessMutation.isPending}
													>
														<XIcon className="h-4 w-4" />
													</Button>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
