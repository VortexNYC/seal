import { Banner } from "@cloudflare/kumo/components/banner";
import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Select } from "@cloudflare/kumo/components/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown as CrownIcon, Users as UsersIcon, X as XIcon } from "@phosphor-icons/react";
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
import { getErrorMessage } from "@/lib/utils";

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
  { label: string; description: string }
> = {
  private: {
    label: "Private",
    description: "Only you and people you share with can access",
  },
  workspace: {
    label: "Workspace",
    description: "Everyone in your workspace can access",
  },
  specific: {
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="flex max-h-vh-85 flex-col overflow-hidden p-0">
            <div className="border-kumo-line flex items-center justify-between border-b px-6 pt-6 pb-4">
              <div>
                <Dialog.Title>Share document</Dialog.Title>
                <Dialog.Description>&quot;{documentName}&quot;</Dialog.Description>
              </div>
              <Dialog.Close
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    aria-label="Close"
                  />
                }
              />
            </div>

            {/* Content */}
            <div className="max-h-vh-60 overflow-y-auto px-6 py-5">
              {documentAccess === undefined ? (
                <ShareDialogSkeleton />
              ) : documentAccess === null ? (
                <div className="text-kumo-secondary py-8 text-center">
                  You don't have permission to view sharing settings.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Subscription Warning Banner */}
                  {documentAccess.subscriptionWarning && (
                    <Banner
                      data-testid="subscription-warning"
                      variant="alert"
                      size="sm"
                      description={documentAccess.subscriptionWarning}
                    />
                  )}

                  {/* Sharing Mode Selection */}
                  <div className="space-y-3">
                    <Text as="p" size="sm" bold>General access</Text>
                    <div className="grid grid-cols-3 gap-2">
                      {SHARING_MODES.map((mode) => {
                        const info = SHARING_MODE_INFO[mode];
                        const isSelected = documentAccess.sharingMode === mode;
                        const requiresPro =
                          mode === "workspace" || mode === "specific";
                        const isDisabled =
                          requiresPro && !documentAccess.canUseTeamSharing;
                        return (
                          <Button
                            key={mode}
                            type="button"
                            variant={isSelected ? "primary" : "secondary"}
                            className="w-full"
                            onClick={() => handleSharingModeChange(mode)}
                            disabled={isUpdating || isDisabled}
                          >
                            {info.label}
                            {requiresPro &&
                            !documentAccess.canUseTeamSharing ? (
                              <Badge variant="primary">Pro</Badge>
                            ) : null}
                          </Button>
                        );
                      })}
                    </div>
                    <Text as="p" variant="secondary" size="xs">{sharingModeDescription}</Text>
                  </div>

                  {/* Add Team Member */}
                  {documentAccess.sharingMode === "specific" && (
                    <div className="space-y-3">
                      <Text as="p" size="sm" bold>Add people</Text>
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
                                  <span className="text-kumo-secondary text-xs">
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
                          loading={isUpdating}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* People with Access */}
                  <div className="space-y-3">
                    <Text as="p" size="sm" bold>People with access</Text>
                    <div className="space-y-2" data-testid="access-list">
                      {/* Document Owner */}
                      <div
                        data-testid="owner-row"
                        className="bg-kumo-elevated flex items-center justify-between rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-kumo-warning-tint text-kumo-warning flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                            {getInitials(
                              documentAccess.owner.name ??
                                documentAccess.owner.email
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                data-testid="owner-name"
                                className="text-kumo-default text-sm font-medium"
                              >
                                {documentAccess.owner.name ??
                                  documentAccess.owner.email}
                              </span>
                              <Badge variant="warning" icon={CrownIcon}>
                                Owner
                              </Badge>
                            </div>
                            {documentAccess.owner.name && (
                              <span className="text-kumo-secondary text-xs">
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
                          className="bg-kumo-elevated flex items-center justify-between rounded-xl p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-kumo-elevated text-kumo-default flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                              {getInitials(access.userName ?? access.userEmail)}
                            </div>
                            <div>
                              <span
                                data-testid="access-name"
                                className="text-kumo-default text-sm font-medium"
                              >
                                {access.userName ?? access.userEmail}
                              </span>
                              {access.userName && (
                                <Text as="p" variant="secondary" size="xs">{access.userEmail}</Text>
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
                          <div className="text-kumo-secondary py-6 text-center text-sm">
                            <UsersIcon className="text-kumo-secondary/50 mx-auto mb-2 h-8 w-8" />
                            No one else has access yet
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-kumo-line flex justify-end border-t px-6 py-4">
              <Dialog.Close
                render={<Button variant="secondary" size="sm">Done</Button>}
              />
            </div>
      </Dialog>
    </Dialog.Root>
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
