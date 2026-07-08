import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Calendar, Mail, Shield, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
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
import { useCurrentUser as useUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/$memberId")({
  component: MemberDetails,
  pendingComponent: MemberDetailsSkeleton,
});

type MemberRole = "system" | "owner" | "admin" | "member" | "viewer";
type MemberStatus = "active" | "inactive" | "suspended" | "pending" | "blocked";
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

type TeamMemberDetails = {
  avatarUrl?: string | null;
  customRole?: {
    name: string;
    permissions: readonly unknown[];
  } | null;
  email: string;
  isPrimary?: boolean;
  joinedAt: number;
  name?: string | null;
  role: MemberRole;
  status: MemberStatus;
  timezone?: string | null;
};

const ROLE_BADGE_VARIANTS: Record<MemberRole, BadgeVariant> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  viewer: "secondary",
  system: "destructive",
};

const STATUS_BADGE_VARIANTS: Record<MemberStatus, BadgeVariant> = {
  active: "default",
  inactive: "secondary",
  suspended: "destructive",
  pending: "outline",
  blocked: "destructive",
};

function MemberDetails() {
  const { slug, memberId } = Route.useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const member = useQuery(
    api.organizations.queries.getOrganizationMember,
    orgId && memberId
      ? {
          organizationId: orgId,
          memberId,
        }
      : "skip",
  );

  const removeMember = useMutation(api.organizations.mutations.removeMember);

  const handleRemoveMember = async () => {
    if (!orgId || !memberId) return;

    setIsRemoving(true);
    try {
      await removeMember({
        memberId,
      });

      toast.success("Member removed successfully");
      navigate({
        to: "/$slug/settings/team",
        params: { slug },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setIsRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  // Loading state handled by pendingComponent
  if (!organization || !orgId) {
    return null;
  }

  if (!member) {
    return null;
  }

  const currentEmail =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress;

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
        <MemberProfileCard member={member} currentEmail={currentEmail} />
        <MemberBasicInfoCard member={member} />
        {member.role !== "owner" && (
          <MemberDangerZone
            isRemoving={isRemoving}
            onRemoveClick={() => setShowRemoveDialog(true)}
          />
        )}
      </div>

      <RemoveMemberDialog
        isRemoving={isRemoving}
        memberLabel={member.name || member.email}
        onConfirm={handleRemoveMember}
        onOpenChange={setShowRemoveDialog}
        open={showRemoveDialog}
      />
    </PageWrapper>
  );
}

function MemberProfileCard({
  currentEmail,
  member,
}: {
  currentEmail?: string;
  member: TeamMemberDetails;
}) {
  const isCurrentUser =
    Boolean(currentEmail) && member.email.toLowerCase() === currentEmail?.toLowerCase();

  return (
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
              {isCurrentUser ? (
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
              <MemberRoleBadge role={member.role} />
              <MemberStatusBadge status={member.status} />
              {member.isPrimary ? <Badge variant="outline">Primary Organization</Badge> : null}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function MemberBasicInfoCard({ member }: { member: TeamMemberDetails }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>Member details and account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <MemberInfoItem icon={Calendar} label="Joined" value={formatMemberDate(member.joinedAt)} />
          <MemberInfoItem icon={Shield} label="Role" value={member.role} valueClassName="capitalize" />
          {member.timezone ? <MemberInfoItem label="Timezone" value={member.timezone} /> : null}
          <MemberInfoItem label="Status" value={member.status} valueClassName="capitalize" />
        </div>

        {member.customRole ? <MemberCustomRole customRole={member.customRole} /> : null}
      </CardContent>
    </Card>
  );
}

function MemberInfoItem({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon?: typeof Calendar;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </div>
      <p className={["mt-1 text-sm", valueClassName].filter(Boolean).join(" ")}>{value}</p>
    </div>
  );
}

function MemberCustomRole({
  customRole,
}: {
  customRole: NonNullable<TeamMemberDetails["customRole"]>;
}) {
  return (
    <>
      <Separator />
      <div>
        <div className="text-muted-foreground text-sm font-medium">Custom Role</div>
        <p className="mt-1 text-sm font-medium">{customRole.name}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {customRole.permissions.length} permissions assigned
        </p>
      </div>
    </>
  );
}

function MemberDangerZone({
  isRemoving,
  onRemoveClick,
}: {
  isRemoving: boolean;
  onRemoveClick: () => void;
}) {
  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>Remove this member from the organization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Remove Member</p>
            <p className="text-muted-foreground text-sm">
              This removes the member from this organization. Their account and access to any other
              organizations are unaffected.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={onRemoveClick} disabled={isRemoving}>
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Member
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RemoveMemberDialog({
  isRemoving,
  memberLabel,
  onConfirm,
  onOpenChange,
  open,
}: {
  isRemoving: boolean;
  memberLabel: string;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>
                This removes <span className="font-semibold">{memberLabel}</span> from this
                organization, including:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Their membership in this organization</li>
                <li>Access to this workspace</li>
              </ul>
              <p className="mt-2">
                Their account and access to any other organizations are unaffected.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving ? "Removing..." : "Remove Member"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MemberRoleBadge({ role }: { role: MemberRole }) {
  return (
    <Badge variant={ROLE_BADGE_VARIANTS[role]} className="capitalize">
      {role}
    </Badge>
  );
}

function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANTS[status]} className="capitalize">
      {status}
    </Badge>
  );
}

function getInitials(name: string | null | undefined, email: string) {
  if (!name) {
    return email.slice(0, 2).toUpperCase();
  }

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMemberDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
