import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Select } from "@cloudflare/kumo/components/select";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

import { useOrganizationMembers } from "@/hooks/use-organization-members";
import {
  getDocumentSharing,
  revokeDocumentAccess,
  shareDocument,
  updateDocumentPermission,
  updateDocumentSharing,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";

import { parseSelectValue } from "../../lib/select-values";

interface ShareDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  slug: string;
  organizationSlug: string;
}

type PermissionLevel = "view" | "edit" | "manage";
type SharingMode = "private" | "workspace" | "specific";

const PERMISSION_LEVELS = [
  "view",
  "edit",
  "manage",
] as const satisfies readonly PermissionLevel[];
const SHARING_MODES = [
  "private",
  "workspace",
  "specific",
] as const satisfies readonly SharingMode[];

function isSharingMode(value: string): value is SharingMode {
  return (SHARING_MODES as readonly string[]).includes(value);
}

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
  slug,
  organizationSlug,
}: ShareDocumentDialogProps) {
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedPermission, setSelectedPermission] =
    useState<PermissionLevel>("view");
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: documentAccess } = useQuery({
    queryKey: ["api", "documents", documentId, "sharing"],
    queryFn: () => getDocumentSharing(organizationSlug, documentId),
    enabled: open,
  });
  const { data: organizationMembers } = useOrganizationMembers(slug, open);

  const updateSharingMode = useMutation({
    mutationFn: (variables: { publicId: string; sharingMode: SharingMode }) =>
      updateDocumentSharing(
        organizationSlug,
        variables.publicId,
        variables.sharingMode
      ),
  });
  const grantAccess = useMutation({
    mutationFn: (variables: {
      publicId: string;
      userId: string;
      permissionLevel: PermissionLevel;
    }) =>
      shareDocument(
        organizationSlug,
        variables.publicId,
        variables.userId,
        variables.permissionLevel
      ),
  });
  const revokeAccess = useMutation({
    mutationFn: (variables: { publicId: string; userId: string }) =>
      revokeDocumentAccess(
        organizationSlug,
        variables.publicId,
        variables.userId
      ),
  });
  const updateAccessLevel = useMutation({
    mutationFn: (variables: {
      publicId: string;
      userId: string;
      permissionLevel: PermissionLevel;
    }) =>
      updateDocumentPermission(
        organizationSlug,
        variables.publicId,
        variables.userId,
        variables.permissionLevel
      ),
  });

  const handleSharingModeChange = async (mode: SharingMode) => {
    setIsUpdating(true);
    try {
      await updateSharingMode.mutateAsync({
        publicId: documentId,
        sharingMode: mode,
      });
      toast.success("Sharing settings updated");
      void queryClient.invalidateQueries({
        queryKey: ["api", "documents", documentId, "sharing"],
      });
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
      await grantAccess.mutateAsync({
        publicId: documentId,
        userId: selectedMemberId,
        permissionLevel: selectedPermission,
      });
      toast.success("Access granted");
      setSelectedMemberId(null);
      void queryClient.invalidateQueries({
        queryKey: ["api", "documents", documentId, "sharing"],
      });
    } catch (error) {
      toast.error("Failed to grant access", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    setIsUpdating(true);
    try {
      await revokeAccess.mutateAsync({ publicId: documentId, userId });
      toast.success("Access revoked");
      void queryClient.invalidateQueries({
        queryKey: ["api", "documents", documentId, "sharing"],
      });
    } catch (error) {
      toast.error("Failed to revoke access", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePermission = async (
    userId: string,
    newPermission: PermissionLevel
  ) => {
    setIsUpdating(true);
    try {
      await updateAccessLevel.mutateAsync({
        publicId: documentId,
        userId,
        permissionLevel: newPermission,
      });
      toast.success("Permission updated");
      void queryClient.invalidateQueries({
        queryKey: ["api", "documents", documentId, "sharing"],
      });
    } catch (error) {
      toast.error("Failed to update permission", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Get members who don't have access yet (for the add member dropdown)
  const sharedUserIds = new Set(
    documentAccess?.sharedWith.map((access) => access.userId) ?? []
  );
  const availableMembers =
    organizationMembers?.filter((m) => !sharedUserIds.has(m.userId)) ?? [];

  const sharingModeDescription =
    documentAccess &&
    !documentAccess.canUseTeamSharing &&
    documentAccess.sharingMode === "private"
      ? "Upgrade to Professional to share with your team"
      : documentAccess && isSharingMode(documentAccess.sharingMode)
        ? SHARING_MODE_INFO[documentAccess.sharingMode].description
        : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay with subtle blur */}
        {/* vortex-allow-color: modal/dialog scrim needs fixed black opacity for backdrop contrast. */}
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />

        {/* Dialog Content */}
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 duration-200">
          {/* Card with layered shadow for depth */}
          <div className="bg-card border-border relative overflow-hidden rounded-xl border shadow-sm">
            {/* Header */}
            <div className="border-border border-b px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <Share2Icon className="text-foreground h-5 w-5" />
                  </div>
                  <div>
                    <DialogPrimitive.Title className="text-foreground font-serif text-lg font-medium">
                      Share document
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="text-muted-foreground mt-0.5 text-sm">
                      "{documentName}"
                    </DialogPrimitive.Description>
                  </div>
                </div>
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Close"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
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
                      <p className="text-warning text-sm">
                        {documentAccess.subscriptionWarning}
                      </p>
                    </div>
                  )}

                  {/* Sharing Mode Selection */}
                  <div className="space-y-3">
                    <p className="text-foreground text-sm font-medium">
                      General access
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {SHARING_MODES.map((mode) => {
                        const info = SHARING_MODE_INFO[mode];
                        const isSelected = documentAccess.sharingMode === mode;
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
                              "relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors",
                              isSelected
                                ? "border-foreground bg-muted"
                                : "border-border hover:bg-muted/60",
                              (isUpdating || isDisabled) &&
                                "cursor-not-allowed opacity-50"
                            )}
                          >
                            {requiresPro &&
                              !documentAccess.canUseTeamSharing && (
                                <Badge
                                  variant="outline"
                                  className="border-border bg-card text-muted-foreground absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px]"
                                >
                                  Pro
                                </Badge>
                              )}
                            <div
                              className={cn(
                                "rounded-lg p-2",
                                isSelected
                                  ? "bg-card text-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {info.icon}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-medium",
                                isSelected
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {info.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {sharingModeDescription}
                    </p>
                  </div>

                  {/* Add Team Member */}
                  {documentAccess.sharingMode === "specific" && (
                    <div className="space-y-3">
                      <p className="text-foreground text-sm font-medium">
                        Add people
                      </p>
                      <div className="flex gap-2">
                        <Select
                          value={selectedMemberId ?? ""}
                          onValueChange={(value) => setSelectedMemberId(value)}
                          placeholder="Select a team member"
                          className="flex-1"
                          data-testid="member-select"
                        >
                          {availableMembers.map((member) => (
                            <Select.Option
                              key={member.userId}
                              value={member.userId}
                            >
                              <div className="flex items-center gap-2">
                                <span>{member.name ?? member.email}</span>
                                {member.name && (
                                  <span className="text-muted-foreground text-xs">
                                    {member.email}
                                  </span>
                                )}
                              </div>
                            </Select.Option>
                          ))}
                        </Select>

                        <Select
                          value={selectedPermission}
                          onValueChange={(value) => {
                            if (!value) return;
                            setSelectedPermission(
                              parseSelectValue(value, PERMISSION_LEVELS) ??
                                selectedPermission
                            );
                          }}
                          className="w-32"
                          data-testid="permission-select"
                        >
                          <Select.Option value="view">Can view</Select.Option>
                          <Select.Option value="edit">Can edit</Select.Option>
                          <Select.Option value="manage">
                            Can manage
                          </Select.Option>
                        </Select>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleGrantAccess}
                          disabled={!selectedMemberId || isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* People with Access */}
                  <div className="space-y-3">
                    <p className="text-foreground text-sm font-medium">
                      People with access
                    </p>
                    <div className="space-y-2" data-testid="access-list">
                      {/* Document Owner */}
                      <div
                        data-testid="owner-row"
                        className="bg-muted flex items-center justify-between rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-warning-surface text-warning-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                            {getInitials(
                              documentAccess.owner.name ??
                                documentAccess.owner.email
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                data-testid="owner-name"
                                className="text-foreground text-sm font-medium"
                              >
                                {documentAccess.owner.name ??
                                  documentAccess.owner.email}
                              </span>
                              <Badge
                                variant="outline"
                                className="border-warning/30 bg-warning-surface text-warning text-xs"
                                icon={CrownIcon}
                              >
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
                          key={access.id}
                          data-testid="shared-user"
                          className="bg-muted flex items-center justify-between rounded-xl p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-muted text-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                              {getInitials(access.userName ?? access.userEmail)}
                            </div>
                            <div>
                              <span
                                data-testid="access-name"
                                className="text-foreground text-sm font-medium"
                              >
                                {access.userName ?? access.userEmail}
                              </span>
                              {access.userName && (
                                <p className="text-muted-foreground text-xs">
                                  {access.userEmail}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={access.permissionLevel}
                              onValueChange={(value) => {
                                if (!value) return;
                                const level = parseSelectValue(
                                  value,
                                  PERMISSION_LEVELS
                                );
                                if (level) {
                                  void handleUpdatePermission(
                                    access.userId,
                                    level
                                  );
                                }
                              }}
                              disabled={isUpdating}
                              size="sm"
                              className="w-28"
                              data-testid="permission-dropdown"
                            >
                              <Select.Option value="view">
                                Can view
                              </Select.Option>
                              <Select.Option value="edit">
                                Can edit
                              </Select.Option>
                              <Select.Option value="manage">
                                Can manage
                              </Select.Option>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid="revoke-access-button"
                              onClick={() => handleRevokeAccess(access.userId)}
                              disabled={isUpdating}
                              className="p-1.5"
                              aria-label="Revoke access"
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
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
                <Button variant="secondary" size="sm">
                  Done
                </Button>
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
        <SkeletonLine className="h-4 w-24" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLine key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <SkeletonLine className="h-4 w-32" />
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonLine key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
