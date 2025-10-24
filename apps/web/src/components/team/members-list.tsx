/**
 * Members List Component
 *
 * Displays organization members in a table with role management
 */

import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { RemoveMemberDialog } from "./remove-member-dialog";
import { RoleSelector } from "./role-selector";

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

interface MembersListProps {
	members: Member[];
	organizationId: Id<"organizations">;
	canManageRoles: boolean;
	canRemove: boolean;
}

export function MembersList({
	members,
	organizationId,
	canManageRoles,
	canRemove,
}: MembersListProps) {
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);
	const [showRemoveDialog, setShowRemoveDialog] = useState(false);

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

	const getStatusBadge = (status: Member["status"]) => {
		const variants: Record<
			Member["status"],
			"default" | "secondary" | "destructive" | "outline"
		> = {
			active: "default",
			inactive: "secondary",
			suspended: "destructive",
			pending: "outline",
			blocked: "destructive",
		};

		return (
			<Badge variant={variants[status]} className="capitalize">
				{status}
			</Badge>
		);
	};

	const getRoleBadge = (role: Member["role"]) => {
		const colors: Record<Member["role"], string> = {
			owner:
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
			admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			member:
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
			system: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		};

		return (
			<Badge variant="outline" className={colors[role]}>
				{role}
			</Badge>
		);
	};

	const formatJoinDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	if (members.length === 0) {
		return (
			<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
				No members found
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Member</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Joined</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.id}>
							<TableCell>
								<div className="flex items-center gap-3">
									<Avatar>
										<AvatarImage src={member.avatarUrl ?? undefined} />
										<AvatarFallback>
											{getInitials(member.name, member.email)}
										</AvatarFallback>
									</Avatar>
									<div>
										<div className="font-medium">
											{member.name || "Unknown"}
										</div>
										<div className="text-sm text-muted-foreground">
											{member.email}
										</div>
									</div>
								</div>
							</TableCell>
							<TableCell>
								{canManageRoles && member.role !== "owner" ? (
									<RoleSelector
										memberId={member.id}
										currentRole={member.role}
										organizationId={organizationId}
									/>
								) : (
									getRoleBadge(member.role)
								)}
							</TableCell>
							<TableCell>{getStatusBadge(member.status)}</TableCell>
							<TableCell className="text-sm text-muted-foreground">
								{formatJoinDate(member.joinedAt)}
							</TableCell>
							<TableCell className="text-right">
								{(canManageRoles || canRemove) && member.role !== "owner" && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuLabel>Actions</DropdownMenuLabel>
											<DropdownMenuSeparator />
											{canRemove && (
												<DropdownMenuItem
													className="text-destructive"
													onSelect={() => {
														setSelectedMember(member);
														setShowRemoveDialog(true);
													}}
												>
													Remove member
												</DropdownMenuItem>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			{selectedMember && (
				<RemoveMemberDialog
					member={selectedMember}
					organizationId={organizationId}
					open={showRemoveDialog}
					onOpenChange={setShowRemoveDialog}
				/>
			)}
		</>
	);
}
