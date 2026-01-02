import * as DialogPrimitive from "@radix-ui/react-dialog";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangleIcon,
	CrownIcon,
	Loader2Icon,
	LockIcon,
	Share2Icon,
	UserPlusIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";

interface ShareDocumentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentId: Id<"documents">;
	documentName: string;
}

type PermissionLevel = "view" | "edit" | "manage";
type SharingMode = "private" | "workspace" | "specific";

const SHARING_MODE_INFO: Record<
	SharingMode,
	{ icon: React.ReactNode; label: string; description: string }
> = {
	private: {
		icon: <LockIcon className="h-4 w-4" />,
		label: "Private",
		description: "Only you and people you share with can access",
	},
	workspace: {
		icon: <UsersIcon className="h-4 w-4" />,
		label: "Workspace",
		description: "Everyone in your workspace can access",
	},
	specific: {
		icon: <UserPlusIcon className="h-4 w-4" />,
		label: "Specific people",
		description: "Share with specific team members",
	},
};

/**
 * ShareDocumentDialog - Share document with team members
 *
 * An editorial-styled dialog for managing document sharing settings
 * and granting access to specific team members.
 */
export function ShareDocumentDialog({
	open,
	onOpenChange,
	documentId,
	documentName,
}: ShareDocumentDialogProps) {
	const [selectedMemberId, setSelectedMemberId] = useState<Id<"users"> | null>(
		null,
	);
	const [selectedPermission, setSelectedPermission] =
		useState<PermissionLevel>("view");
	const [isUpdating, setIsUpdating] = useState(false);

	const documentAccess = useQuery(api.documents.sharing.getDocumentAccess, {
		documentId,
	});
	const shareableMembers = useQuery(api.documents.sharing.getShareableMembers, {
		documentId,
	});

	const updateSharingMode = useMutation(
		api.documents.sharing.updateSharingMode,
	);
	const grantAccess = useMutation(api.documents.sharing.grantAccess);
	const revokeAccess = useMutation(api.documents.sharing.revokeAccess);
	const updateAccessLevel = useMutation(
		api.documents.sharing.updateAccessLevel,
	);

	const handleSharingModeChange = async (mode: SharingMode) => {
		setIsUpdating(true);
		try {
			await updateSharingMode({ documentId, sharingMode: mode });
			toast.success("Sharing settings updated");
		} catch (error) {
			toast.error("Failed to update sharing settings", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const handleGrantAccess = async () => {
		if (!selectedMemberId) return;

		setIsUpdating(true);
		try {
			await grantAccess({
				documentId,
				userId: selectedMemberId,
				permissionLevel: selectedPermission,
			});
			toast.success("Access granted");
			setSelectedMemberId(null);
		} catch (error) {
			toast.error("Failed to grant access", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const handleRevokeAccess = async (userId: Id<"users">) => {
		setIsUpdating(true);
		try {
			await revokeAccess({ documentId, userId });
			toast.success("Access revoked");
		} catch (error) {
			toast.error("Failed to revoke access", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const handleUpdatePermission = async (
		userId: Id<"users">,
		newPermission: PermissionLevel,
	) => {
		setIsUpdating(true);
		try {
			await updateAccessLevel({
				documentId,
				userId,
				newPermissionLevel: newPermission,
			});
			toast.success("Permission updated");
		} catch (error) {
			toast.error("Failed to update permission", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsUpdating(false);
		}
	};

	// Get members who don't have access yet (for the add member dropdown)
	const availableMembers =
		shareableMembers?.filter((m) => !m.hasAccess && !m.isOwner) ?? [];

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				{/* Overlay with subtle blur */}
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

				{/* Dialog Content */}
				<DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[520px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
					{/* Card with layered shadow for depth */}
					<div className="relative bg-white rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]">
						{/* Decorative top accent - blue for sharing */}
						<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500" />

						{/* Header */}
						<div className="px-6 pt-6 pb-4 border-b border-gray-100">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
										<Share2Icon className="w-5 h-5 text-blue-500" />
									</div>
									<div>
										<DialogPrimitive.Title className="font-['Newsreader',Georgia,serif] text-lg font-medium text-gray-900">
											Share document
										</DialogPrimitive.Title>
										<DialogPrimitive.Description className="text-sm text-gray-500 mt-0.5">
											"{documentName}"
										</DialogPrimitive.Description>
									</div>
								</div>
								<DialogPrimitive.Close asChild>
									<button
										type="button"
										className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
									>
										<XIcon className="w-4 h-4" />
									</button>
								</DialogPrimitive.Close>
							</div>
						</div>

						{/* Content */}
						<div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
							{documentAccess === undefined ? (
								<ShareDialogSkeleton />
							) : documentAccess === null ? (
								<div className="text-center py-8 text-gray-500">
									You don't have permission to view sharing settings.
								</div>
							) : (
								<div className="space-y-6">
									{/* Subscription Warning Banner */}
									{documentAccess.subscriptionWarning && (
										<div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
											<AlertTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
											<p className="text-sm text-amber-800">
												{documentAccess.subscriptionWarning}
											</p>
										</div>
									)}

									{/* Sharing Mode Selection */}
									<div className="space-y-3">
										<label className="text-sm font-medium text-gray-700">
											General access
										</label>
										<div className="grid grid-cols-3 gap-2">
											{(Object.keys(SHARING_MODE_INFO) as SharingMode[]).map(
												(mode) => {
													const info = SHARING_MODE_INFO[mode];
													const isSelected =
														documentAccess.sharingMode === mode;
													const requiresPro =
														mode === "workspace" || mode === "specific";
													const isDisabled =
														requiresPro && !documentAccess.canUseTeamSharing;
													return (
														<button
															key={mode}
															type="button"
															onClick={() => handleSharingModeChange(mode)}
															disabled={isUpdating || isDisabled}
															className={cn(
																"relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
																isSelected
																	? "border-blue-500 bg-blue-50"
																	: "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
																(isUpdating || isDisabled) &&
																	"opacity-50 cursor-not-allowed",
															)}
														>
															{requiresPro &&
																!documentAccess.canUseTeamSharing && (
																	<Badge
																		variant="outline"
																		className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-0"
																	>
																		Pro
																	</Badge>
																)}
															<div
																className={cn(
																	"p-2 rounded-lg",
																	isSelected
																		? "bg-blue-100 text-blue-600"
																		: "bg-gray-100 text-gray-500",
																)}
															>
																{info.icon}
															</div>
															<span
																className={cn(
																	"text-xs font-medium",
																	isSelected
																		? "text-blue-700"
																		: "text-gray-600",
																)}
															>
																{info.label}
															</span>
														</button>
													);
												},
											)}
										</div>
										<p className="text-xs text-gray-500">
											{!documentAccess.canUseTeamSharing &&
											documentAccess.sharingMode === "private"
												? "Upgrade to Pro to share with your team"
												: SHARING_MODE_INFO[documentAccess.sharingMode]
														.description}
										</p>
									</div>

									{/* Add Team Member */}
									{documentAccess.sharingMode === "specific" && (
										<div className="space-y-3">
											<label className="text-sm font-medium text-gray-700">
												Add people
											</label>
											<div className="flex gap-2">
												<Select
													value={selectedMemberId ?? ""}
													onValueChange={(value) =>
														setSelectedMemberId(value as Id<"users">)
													}
												>
													<SelectTrigger className="flex-1">
														<SelectValue placeholder="Select a team member" />
													</SelectTrigger>
													<SelectContent>
														{availableMembers.length === 0 ? (
															<div className="px-2 py-4 text-sm text-gray-500 text-center">
																No team members to add
															</div>
														) : (
															availableMembers.map((member) => (
																<SelectItem
																	key={member.userId}
																	value={member.userId}
																>
																	<div className="flex items-center gap-2">
																		<span>{member.name ?? member.email}</span>
																		{member.name && (
																			<span className="text-gray-400 text-xs">
																				{member.email}
																			</span>
																		)}
																	</div>
																</SelectItem>
															))
														)}
													</SelectContent>
												</Select>

												<Select
													value={selectedPermission}
													onValueChange={(value) =>
														setSelectedPermission(value as PermissionLevel)
													}
												>
													<SelectTrigger className="w-32">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="view">Can view</SelectItem>
														<SelectItem value="edit">Can edit</SelectItem>
														<SelectItem value="manage">Can manage</SelectItem>
													</SelectContent>
												</Select>

												<button
													type="button"
													onClick={handleGrantAccess}
													disabled={!selectedMemberId || isUpdating}
													className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
												>
													{isUpdating ? (
														<Loader2Icon className="w-4 h-4 animate-spin" />
													) : (
														"Add"
													)}
												</button>
											</div>
										</div>
									)}

									{/* People with Access */}
									<div className="space-y-3">
										<label className="text-sm font-medium text-gray-700">
											People with access
										</label>
										<div className="space-y-2">
											{/* Document Owner */}
											<div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
												<div className="flex items-center gap-3">
													<Avatar className="h-8 w-8">
														<AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs">
															{getInitials(
																documentAccess.owner.name ??
																	documentAccess.owner.email,
															)}
														</AvatarFallback>
													</Avatar>
													<div>
														<div className="flex items-center gap-2">
															<span className="text-sm font-medium text-gray-900">
																{documentAccess.owner.name ??
																	documentAccess.owner.email}
															</span>
															<Badge
																variant="outline"
																className="text-xs bg-amber-50 text-amber-700 border-amber-200"
															>
																<CrownIcon className="w-3 h-3 mr-1" />
																Owner
															</Badge>
														</div>
														{documentAccess.owner.name && (
															<span className="text-xs text-gray-500">
																{documentAccess.owner.email}
															</span>
														)}
													</div>
												</div>
											</div>

											{/* Shared Users */}
											{documentAccess.sharedWith.map((access) => (
												<div
													key={access._id}
													className="flex items-center justify-between p-3 rounded-xl bg-gray-50"
												>
													<div className="flex items-center gap-3">
														<Avatar className="h-8 w-8">
															<AvatarFallback className="bg-gradient-to-br from-blue-400 to-indigo-500 text-white text-xs">
																{getInitials(
																	access.userName ?? access.userEmail,
																)}
															</AvatarFallback>
														</Avatar>
														<div>
															<span className="text-sm font-medium text-gray-900">
																{access.userName ?? access.userEmail}
															</span>
															{access.userName && (
																<p className="text-xs text-gray-500">
																	{access.userEmail}
																</p>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Select
															value={access.permissionLevel}
															onValueChange={(value) =>
																handleUpdatePermission(
																	access.userId,
																	value as PermissionLevel,
																)
															}
															disabled={isUpdating}
														>
															<SelectTrigger className="w-28 h-8 text-xs">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="view">Can view</SelectItem>
																<SelectItem value="edit">Can edit</SelectItem>
																<SelectItem value="manage">
																	Can manage
																</SelectItem>
															</SelectContent>
														</Select>
														<button
															type="button"
															onClick={() => handleRevokeAccess(access.userId)}
															disabled={isUpdating}
															className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
														>
															<XIcon className="w-4 h-4" />
														</button>
													</div>
												</div>
											))}

											{documentAccess.sharedWith.length === 0 &&
												documentAccess.sharingMode === "specific" && (
													<div className="text-center py-6 text-sm text-gray-500">
														<UsersIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
														No one else has access yet
													</div>
												)}
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Footer */}
						<div className="px-6 py-4 border-t border-gray-100 flex justify-end">
							<DialogPrimitive.Close asChild>
								<button
									type="button"
									className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
								>
									Done
								</button>
							</DialogPrimitive.Close>
						</div>

						{/* Subtle paper texture overlay */}
						<div
							className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-multiply"
							style={{
								backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
							}}
						/>
					</div>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function ShareDialogSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<Skeleton className="h-4 w-24" />
				<div className="grid grid-cols-3 gap-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-20 rounded-xl" />
					))}
				</div>
			</div>
			<div className="space-y-3">
				<Skeleton className="h-4 w-32" />
				{Array.from({ length: 2 }).map((_, i) => (
					<Skeleton key={i} className="h-14 rounded-xl" />
				))}
			</div>
		</div>
	);
}
