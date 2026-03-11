import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
  const [selectedMemberId, setSelectedMemberId] = useState<Id<"users"> | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>("view");
  const [isUpdating, setIsUpdating] = useState(false);

  const documentAccess = useQuery(api.documents.sharing.getDocumentAccess, {
    documentId,
  });
  const shareableMembers = useQuery(api.documents.sharing.getShareableMembers, {
    documentId,
  });

  const updateSharingMode = useMutation(api.documents.sharing.updateSharingMode);
  const grantAccess = useMutation(api.documents.sharing.grantAccess);
  const revokeAccess = useMutation(api.documents.sharing.revokeAccess);
  const updateAccessLevel = useMutation(api.documents.sharing.updateAccessLevel);

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

  const handleUpdatePermission = async (userId: Id<"users">, newPermission: PermissionLevel) => {
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
  const availableMembers = shareableMembers?.filter((m) => !m.hasAccess && !m.isOwner) ?? [];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay with subtle blur */}
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />

        {/* Dialog Content */}
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 duration-200">
          {/* Card with layered shadow for depth */}
          <div className="bg-card relative overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]">
            {/* Decorative top accent - blue for sharing */}
            <div className="from-info/80 via-info/90 to-primary/80 absolute top-0 right-0 left-0 h-1 bg-gradient-to-r" />

            {/* Header */}
            <div className="border-border border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-info-surface flex h-10 w-10 items-center justify-center rounded-xl">
                    <Share2Icon className="text-info h-5 w-5" />
                  </div>
                  <div>
                    <DialogPrimitive.Title className="text-foreground font-['Newsreader',Georgia,serif] text-lg font-medium">
                      Share document
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-muted-foreground mt-0.5 text-sm">
                      "{documentName}"
                    </DialogPrimitive.Description>
                  </div>
                </div>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {documentAccess === undefined ? (
                <ShareDialogSkeleton />
              ) : documentAccess === null ? (
                <div className="text-muted-foreground py-8 text-center">
                  You don't have permission to view sharing settings.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Subscription Warning Banner */}
                  {documentAccess.subscriptionWarning && (
                    <div
                      data-testid="subscription-warning"
                      className="bg-warning-surface border-warning/30 flex items-start gap-3 rounded-xl border p-3"
                    >
                      <AlertTriangleIcon className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
                      <p className="text-warning text-sm">{documentAccess.subscriptionWarning}</p>
                    </div>
                  )}

                  {/* Sharing Mode Selection */}
                  <div className="space-y-3">
                    <p className="text-foreground text-sm font-medium">General access</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(SHARING_MODE_INFO) as SharingMode[]).map((mode) => {
                        const info = SHARING_MODE_INFO[mode];
                        const isSelected = documentAccess.sharingMode === mode;
                        const requiresPro = mode === "workspace" || mode === "specific";
                        const isDisabled = requiresPro && !documentAccess.canUseTeamSharing;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handleSharingModeChange(mode)}
                            disabled={isUpdating || isDisabled}
                            className={cn(
                              "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors",
                              isSelected
                                ? "border-info bg-info-surface"
                                : "border-border hover:border-border hover:bg-muted",
                              (isUpdating || isDisabled) && "cursor-not-allowed opacity-50",
                            )}
                          >
                            {requiresPro && !documentAccess.canUseTeamSharing && (
                              <Badge
                                variant="outline"
                                className="from-info to-primary absolute -top-2 -right-2 border-0 bg-gradient-to-r px-1.5 py-0.5 text-[10px] text-white"
                              >
                                Pro
                              </Badge>
                            )}
                            <div
                              className={cn(
                                "rounded-lg p-2",
                                isSelected
                                  ? "bg-info-surface text-info"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {info.icon}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-medium",
                                isSelected ? "text-info" : "text-muted-foreground",
                              )}
                            >
                              {info.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {!documentAccess.canUseTeamSharing && documentAccess.sharingMode === "private"
                        ? "Upgrade to Pro to share with your team"
                        : SHARING_MODE_INFO[documentAccess.sharingMode].description}
                    </p>
                  </div>

                  {/* Add Team Member */}
                  {documentAccess.sharingMode === "specific" && (
                    <div className="space-y-3">
                      <p className="text-foreground text-sm font-medium">Add people</p>
                      <div className="flex gap-2">
                        <Select
                          value={selectedMemberId ?? ""}
                          onValueChange={(value) => setSelectedMemberId(value as Id<"users">)}
                        >
                          <SelectTrigger className="flex-1" data-testid="member-select">
                            <SelectValue placeholder="Select a team member" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMembers.length === 0 ? (
                              <div className="text-muted-foreground px-2 py-4 text-center text-sm">
                                No team members to add
                              </div>
                            ) : (
                              availableMembers.map((member) => (
                                <SelectItem key={member.userId} value={member.userId}>
                                  <div className="flex items-center gap-2">
                                    <span>{member.name ?? member.email}</span>
                                    {member.name && (
                                      <span className="text-muted-foreground text-xs">
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
                          onValueChange={(value) => setSelectedPermission(value as PermissionLevel)}
                        >
                          <SelectTrigger className="w-32" data-testid="permission-select">
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
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Add"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* People with Access */}
                  <div className="space-y-3">
                    <p className="text-foreground text-sm font-medium">People with access</p>
                    <div className="space-y-2" data-testid="access-list">
                      {/* Document Owner */}
                      <div
                        data-testid="owner-row"
                        className="bg-muted flex items-center justify-between rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="from-warning to-warning/70 bg-gradient-to-br text-xs text-white">
                              {getInitials(documentAccess.owner.name ?? documentAccess.owner.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                data-testid="owner-name"
                                className="text-foreground text-sm font-medium"
                              >
                                {documentAccess.owner.name ?? documentAccess.owner.email}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-warning/30 bg-warning-surface text-warning text-xs"
                              >
                                <CrownIcon className="mr-1 h-3 w-3" />
                                Owner
                              </Badge>
                            </div>
                            {documentAccess.owner.name && (
                              <span className="text-muted-foreground text-xs">
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
                          data-testid="shared-user"
                          className="bg-muted flex items-center justify-between rounded-xl p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="from-primary to-primary/70 bg-gradient-to-br text-xs text-white">
                                {getInitials(access.userName ?? access.userEmail)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span
                                data-testid="access-name"
                                className="text-foreground text-sm font-medium"
                              >
                                {access.userName ?? access.userEmail}
                              </span>
                              {access.userName && (
                                <p className="text-muted-foreground text-xs">{access.userEmail}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={access.permissionLevel}
                              onValueChange={(value) =>
                                handleUpdatePermission(access.userId, value as PermissionLevel)
                              }
                              disabled={isUpdating}
                            >
                              <SelectTrigger
                                className="h-8 w-28 text-xs"
                                data-testid="permission-dropdown"
                              >
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
                              data-testid="revoke-access-button"
                              onClick={() => handleRevokeAccess(access.userId)}
                              disabled={isUpdating}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5 transition-colors disabled:opacity-50"
                            >
                              <XIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {documentAccess.sharedWith.length === 0 &&
                        documentAccess.sharingMode === "specific" && (
                          <div className="text-muted-foreground py-6 text-center text-sm">
                            <UsersIcon className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                            No one else has access yet
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-border flex justify-end border-t px-6 py-4">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="bg-muted text-foreground hover:bg-muted/80 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </DialogPrimitive.Close>
            </div>

            {/* Subtle paper texture overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-multiply"
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
