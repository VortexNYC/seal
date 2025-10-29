/**
 * Members List Component
 *
 * Displays organization members in a table with role management
 */

import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	canRemove: _canRemove,
}: MembersListProps) {
	const { slug } = useParams({ strict: false });
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedRoles, setSelectedRoles] = useState<Set<Member["role"]>>(
		new Set(),
	);

	// Available roles for filtering
	const availableRoles: Member["role"][] = [
		"owner",
		"admin",
		"member",
		"viewer",
		"system",
	];

	// Filter members based on search query and selected roles
	const filteredMembers = useMemo(() => {
		let filtered = members;

		// Apply role filter
		if (selectedRoles.size > 0) {
			filtered = filtered.filter((member) => selectedRoles.has(member.role));
		}

		// Apply search query filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((member) => {
				const name = member.name?.toLowerCase() || "";
				const email = member.email.toLowerCase();
				const role = member.role.toLowerCase();
				return (
					name.includes(query) || email.includes(query) || role.includes(query)
				);
			});
		}

		return filtered;
	}, [members, searchQuery, selectedRoles]);

	const toggleRole = (role: Member["role"]) => {
		setSelectedRoles((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(role)) {
				newSet.delete(role);
			} else {
				newSet.add(role);
			}
			return newSet;
		});
	};

	const clearRoleFilter = () => {
		setSelectedRoles(new Set());
	};

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

	return (
		<div className="space-y-4">
			{/* Search Bar and Filters */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
				<Input
					placeholder="Search members..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="flex-1 sm:max-w-md"
				/>

				{/* Role Filter Dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="default" className="gap-2">
							<Filter className="size-4" />
							Role
							{selectedRoles.size > 0 && (
								<Badge variant="secondary" className="ml-1 rounded-full px-1.5">
									{selectedRoles.size}
								</Badge>
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-48">
						<DropdownMenuLabel>Filter by role</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{availableRoles.map((role) => (
							<DropdownMenuCheckboxItem
								key={role}
								checked={selectedRoles.has(role)}
								onCheckedChange={() => toggleRole(role)}
								className="capitalize"
							>
								{role}
							</DropdownMenuCheckboxItem>
						))}
						{selectedRoles.size > 0 && (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={(e) => {
										e.preventDefault();
										clearRoleFilter();
									}}
									className="text-muted-foreground"
								>
									Clear filters
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Active Role Filter Badges */}
				{selectedRoles.size > 0 && (
					<div className="flex items-center gap-2 flex-wrap">
						{Array.from(selectedRoles).map((role) => (
							<Badge
								key={role}
								variant="secondary"
								className="gap-1 capitalize"
							>
								{role}
								<button
									type="button"
									onClick={() => toggleRole(role)}
									className="ml-1 rounded-full hover:bg-muted"
								>
									<X className="size-3" />
								</button>
							</Badge>
						))}
					</div>
				)}
			</div>

			{/* Members Table */}
			{filteredMembers.length === 0 ? (
				<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
					{searchQuery
						? "No members found matching your search"
						: "No members found"}
				</div>
			) : (
				<div className="rounded-md border overflow-hidden">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="min-w-[200px]">Member</TableHead>
									<TableHead className="min-w-[120px]">Role</TableHead>
									<TableHead className="min-w-[100px] hidden sm:table-cell">
										Status
									</TableHead>
									<TableHead className="min-w-[120px] hidden md:table-cell">
										Joined
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredMembers.map((member) => (
									<TableRow
										key={member.id}
										className="hover:bg-muted/50 cursor-pointer"
										onClick={() => {
											if (!slug) return;
											navigate({
												to: "/$slug/settings/team/$memberId",
												params: { slug, memberId: member.id },
											});
										}}
									>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar className="h-8 w-8 sm:h-10 sm:w-10">
													<AvatarImage src={member.avatarUrl ?? undefined} />
													<AvatarFallback>
														{getInitials(member.name, member.email)}
													</AvatarFallback>
												</Avatar>
												<div className="min-w-0">
													<div className="font-medium truncate">
														{member.name || "Unknown"}
													</div>
													<div className="text-xs sm:text-sm text-muted-foreground truncate">
														{member.email}
													</div>
												</div>
											</div>
										</TableCell>
										<TableCell onClick={(e) => e.stopPropagation()}>
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
										<TableCell className="hidden sm:table-cell">
											{getStatusBadge(member.status)}
										</TableCell>
										<TableCell className="hidden md:table-cell text-sm text-muted-foreground">
											{formatJoinDate(member.joinedAt)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}
		</div>
	);
}
