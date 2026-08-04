/**
 * Members List Component
 *
 * Displays organization members in a table with role management
 */

import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Filter, SearchIcon, UsersIcon, X } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";

import { RoleSelector } from "./role-selector";

interface Member {
  id: string;
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
  const { user } = useUser();
  const { slug } = useParams({ strict: false });
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<Member["role"]>>(
    new Set()
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

  const isCurrentUser = (member: Member) => {
    if (!user) return false;

    const currentEmail =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress;

    return (
      Boolean(currentEmail) &&
      member.email.toLowerCase() === currentEmail.toLowerCase()
    );
  };

  const getRoleBadge = (role: Member["role"]) => {
    const colors: Record<Member["role"], string> = {
      owner: "bg-role-owner-surface text-role-owner",
      admin: "bg-role-admin-surface text-role-admin",
      member: "bg-role-member-surface text-role-member",
      viewer: "bg-role-viewer-surface text-role-viewer",
      system: "bg-role-system-surface text-role-system",
    };

    return (
      <Badge
        variant="outline"
        className={colors[role]}
        data-testid="member-role"
      >
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
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
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
          <div className="flex flex-wrap items-center gap-2">
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
                  className="hover:bg-muted ml-1 rounded-full"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* SEA-140: Enhanced empty state for members */}
      {filteredMembers.length === 0 ? (
        searchQuery || selectedRoles.size > 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="No members found"
            description="No members match your search or filters. Try adjusting your criteria."
            withCard={false}
          />
        ) : (
          <EmptyState
            icon={UsersIcon}
            title="No team members"
            description="Your team is empty. Invite colleagues to collaborate on documents and manage your workspace together."
            withCard={false}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Member</TableHead>
                  <TableHead className="min-w-[120px]">Role</TableHead>
                  <TableHead className="hidden min-w-[100px] sm:table-cell">
                    Status
                  </TableHead>
                  <TableHead className="hidden min-w-[120px] md:table-cell">
                    Joined
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow
                    key={member.id}
                    data-member-email={member.email}
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
                          <div className="flex items-center gap-2 truncate font-medium">
                            <span className="truncate">
                              {member.name || "Unknown"}
                            </span>
                            {isCurrentUser(member) ? (
                              <Badge variant="secondary" className="shrink-0">
                                You
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground truncate text-xs sm:text-sm">
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
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
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
