/**
 * Dashboard Recent Activity
 *
 * Shows the 10 most recent audit-log entries with actor names, action icons,
 * and relative timestamps. Includes skeleton loading state.
 */

import { useQuery } from "@tanstack/react-query";
import {
  ActivityIcon,
  CheckCircle2Icon,
  FileEditIcon,
  FilePlusIcon,
  FileTextIcon,
  MailIcon,
  PenToolIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRecentActivity } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";

// ─── Action label / icon map ──────────────────────────────────────────────

const ACTION_LABELS: Record<
  string,
  { label: string; icon: LucideIcon; color?: string }
> = {
  "document.created": {
    label: "created a document",
    icon: FilePlusIcon,
    color: "text-success",
  },
  "document.updated": { label: "updated a document", icon: FileEditIcon },
  "document.deleted": {
    label: "deleted a document",
    icon: XCircleIcon,
    color: "text-destructive",
  },
  "document.sent": {
    label: "sent a document for signing",
    icon: MailIcon,
    color: "text-info",
  },
  "document.viewed": { label: "viewed a document", icon: FileTextIcon },
  "document.completed": {
    label: "completed a document",
    icon: CheckCircle2Icon,
    color: "text-success",
  },
  "document.cancelled": {
    label: "cancelled a document",
    icon: XCircleIcon,
    color: "text-destructive",
  },
  "recipient.added": { label: "added a recipient", icon: UserPlusIcon },
  "recipient.signed": {
    label: "signed a document",
    icon: PenToolIcon,
    color: "text-success",
  },
  "recipient.declined": {
    label: "declined to sign",
    icon: XCircleIcon,
    color: "text-destructive",
  },
  "recipient.viewed": { label: "viewed a document", icon: FileTextIcon },
  "member.invited": {
    label: "invited a team member",
    icon: UserPlusIcon,
    color: "text-info",
  },
  "member.joined": {
    label: "joined the team",
    icon: UsersIcon,
    color: "text-success",
  },
  "member.removed": {
    label: "removed a team member",
    icon: XCircleIcon,
    color: "text-destructive",
  },
};

function getActionLabel(action: string): {
  label: string;
  icon: LucideIcon;
  color?: string;
} {
  return (
    ACTION_LABELS[action] ?? {
      label: action.replace(".", " "),
      icon: ActivityIcon,
    }
  );
}

// ─── Component ────────────────────────────────────────────────────────────

interface RecentActivityProps {
  organizationSlug: string;
}

export function RecentActivity({
  organizationSlug,
}: RecentActivityProps): React.ReactElement {
  const { data: activities, isPending } = useQuery({
    queryKey: ["api", "activity", organizationSlug],
    queryFn: () => getRecentActivity(organizationSlug, 10),
  });

  // Loading skeleton
  if (isPending || activities === undefined) {
    return (
      <Card
        style={{
          animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
          animationDelay: "400ms",
        }}
      >
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions in your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="space-y-3"
            role="status"
            aria-label="Loading activity"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3">
                <div className="bg-muted h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <div className="bg-muted mb-1 h-4 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "400ms",
      }}
    >
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest actions in your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 text-sm">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
              <ActivityIcon className="text-muted-foreground/60 h-5 w-5" />
            </div>
            <span>No recent activity</span>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => {
              const {
                label,
                icon: Icon,
                color,
              } = getActionLabel(activity.action);
              return (
                <div
                  key={activity.id}
                  className="group hover:bg-secondary/50 -mx-1 flex items-start gap-3 rounded-lg px-1 py-2 transition-colors duration-[var(--duration-fast)]"
                >
                  <div
                    className={cn(
                      "bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]",
                      "group-hover:bg-secondary"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        color ?? "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{activity.actorName}</span>{" "}
                      <span className="text-muted-foreground">{label}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
