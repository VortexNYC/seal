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
  memberId: string;
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
    api.organizations.mutations.updateMemberRole
  );

  const handleRoleChange = async (newRole: string) => {
    if (newRole === currentRole) return;

    setIsUpdating(true);

    try {
      await updateMemberRole({
        memberId,
        role: newRole as "admin" | "member" | "viewer" | "owner",
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
      owner: "bg-role-owner-surface text-role-owner",
      admin: "bg-role-admin-surface text-role-admin",
      member: "bg-role-member-surface text-role-member",
      viewer: "bg-role-viewer-surface text-role-viewer",
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
            <span className="text-muted-foreground text-xs">
              Read-only access
            </span>
          </div>
        </SelectItem>
        <SelectItem value="member">
          <div className="flex flex-col items-start">
            <span className="font-medium">Member</span>
            <span className="text-muted-foreground text-xs">
              Can create documents
            </span>
          </div>
        </SelectItem>
        <SelectItem value="admin">
          <div className="flex flex-col items-start">
            <span className="font-medium">Admin</span>
            <span className="text-muted-foreground text-xs">
              Manage team & settings
            </span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
