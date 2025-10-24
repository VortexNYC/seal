/**
 * Role Selector Component
 *
 * Dropdown to change a member's role
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface RoleSelectorProps {
	memberId: Id<"organization_members">;
	currentRole: "system" | "owner" | "admin" | "member" | "viewer";
	organizationId: Id<"organizations">;
}

export function RoleSelector({
	memberId,
	currentRole,
	organizationId: _organizationId,
}: RoleSelectorProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const updateMemberRole = useMutation(
		api.organizations.mutations.updateMemberRole,
	);

	const handleRoleChange = async (newRole: string) => {
		if (newRole === currentRole) return;

		setIsUpdating(true);

		try {
			await updateMemberRole({
				memberId,
				newRole: newRole as "admin" | "member" | "viewer",
			});

			toast.success("Role updated", {
				description: `Member role has been changed to ${newRole}`,
			});
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to update role";
			toast.error("Failed to update role", {
				description: errorMessage,
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const getRoleBadgeClass = (role: string) => {
		const colors: Record<string, string> = {
			owner:
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
			admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			member:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
		};
		return colors[role] || colors.viewer;
	};

	// Don't allow changing owner or system roles
	if (currentRole === "owner" || currentRole === "system") {
		return (
			<Badge variant="outline" className={getRoleBadgeClass(currentRole)}>
				{currentRole}
			</Badge>
		);
	}

	return (
		<Select
			value={currentRole}
			onValueChange={handleRoleChange}
			disabled={isUpdating}
		>
			<SelectTrigger className="w-[120px]">
				<SelectValue>
					<Badge variant="outline" className={getRoleBadgeClass(currentRole)}>
						{currentRole}
					</Badge>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="viewer">
					<div className="flex flex-col items-start">
						<span className="font-medium">Viewer</span>
						<span className="text-xs text-muted-foreground">
							Read-only access
						</span>
					</div>
				</SelectItem>
				<SelectItem value="member">
					<div className="flex flex-col items-start">
						<span className="font-medium">Member</span>
						<span className="text-xs text-muted-foreground">
							Can create documents
						</span>
					</div>
				</SelectItem>
				<SelectItem value="admin">
					<div className="flex flex-col items-start">
						<span className="font-medium">Admin</span>
						<span className="text-xs text-muted-foreground">
							Manage team & settings
						</span>
					</div>
				</SelectItem>
			</SelectContent>
		</Select>
	);
}
