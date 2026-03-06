import { useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ArrowLeft, Calendar, Mail, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { MemberDetailsSkeleton } from "@/components/skeletons/member-details-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/$memberId")({
  component: MemberDetails,
  pendingComponent: MemberDetailsSkeleton,
});

function MemberDetails() {
  const { slug, memberId } = Route.useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const member = useQuery(
    api.organizations.queries.getOrganizationMember,
    orgId && memberId
      ? {
          organizationId: orgId,
          memberId: memberId as Id<"organization_members">,
        }
      : "skip",
  );

  const deleteUser = useAction(api.organizations.actions.clerkDeleteUser);

  const handleDeleteUser = async () => {
    if (!orgId || !memberId) return;

    setIsDeleting(true);
    try {
      await deleteUser({
        memberId: memberId as Id<"organization_members">,
        organizationId: orgId,
      });

      toast.success("User deleted successfully");
      navigate({
        to: "/$slug/settings/team",
        params: { slug },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Loading state handled by pendingComponent
  if (!organization || !orgId) {
    return null;
  }

  if (!member) {
    return null;
  }

  const getInitials = (name: string | null | undefined, email: string) => {
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

  const getRoleBadge = (role: "system" | "owner" | "admin" | "member" | "viewer") => {
    const variants: Record<typeof role, "default" | "secondary" | "outline" | "destructive"> = {
      owner: "default",
      admin: "secondary",
      member: "outline",
      viewer: "secondary",
      system: "destructive",
    };

    return (
      <Badge variant={variants[role]} className="capitalize">
        {role}
      </Badge>
    );
  };

  const getStatusBadge = (status: "active" | "inactive" | "suspended" | "pending" | "blocked") => {
    const variants: Record<typeof status, "default" | "secondary" | "destructive" | "outline"> = {
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isCurrentUser = () => {
    if (!user) return false;

    const currentEmail =
      user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress;

    return Boolean(currentEmail) && member.email.toLowerCase() === currentEmail.toLowerCase();
  };

  return (
    <PageWrapper
      title="Member Details"
      action={{
        label: "Back to Team",
        onClick: () => {
          navigate({
            to: "/$slug/settings/team",
            params: { slug },
          });
        },
        icon: ArrowLeft,
        variant: "ghost",
      }}
    >
      <div className="space-y-6">
        {/* Member Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xl">
                  {getInitials(member.name, member.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <span>{member.name || "Unknown User"}</span>
                  {isCurrentUser() ? (
                    <Badge variant="secondary" className="shrink-0">
                      You
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </CardDescription>
                <div className="mt-3 flex items-center gap-2">
                  {getRoleBadge(member.role)}
                  {getStatusBadge(member.status)}
                  {member.isPrimary && <Badge variant="outline">Primary Organization</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Member details and account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  Joined
                </div>
                <p className="mt-1 text-sm">{formatDate(member.joinedAt)}</p>
              </div>

              <div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  Role
                </div>
                <p className="mt-1 text-sm capitalize">{member.role}</p>
              </div>

              {member.timezone && (
                <div>
                  <div className="text-muted-foreground text-sm font-medium">Timezone</div>
                  <p className="mt-1 text-sm">{member.timezone}</p>
                </div>
              )}

              <div>
                <div className="text-muted-foreground text-sm font-medium">Status</div>
                <p className="mt-1 text-sm capitalize">{member.status}</p>
              </div>
            </div>

            {member.customRole && (
              <>
                <Separator />
                <div>
                  <div className="text-muted-foreground text-sm font-medium">Custom Role</div>
                  <p className="mt-1 text-sm font-medium">{member.customRole.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {member.customRole.permissions.length} permissions assigned
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone - Delete User */}
        {member.role !== "owner" && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete this user from the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete User</p>
                  <p className="text-muted-foreground text-sm">
                    This will permanently delete the user from Clerk and all their data from the
                    system. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  This action cannot be undone. This will permanently delete the user{" "}
                  <span className="font-semibold">{member.name || member.email}</span> from Clerk
                  and remove all their data from the system, including:
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  <li>User account and profile</li>
                  <li>All organization memberships</li>
                  <li>Access to all workspaces</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
