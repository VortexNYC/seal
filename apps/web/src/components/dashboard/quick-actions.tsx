/**
 * Dashboard Quick Actions
 *
 * Redesigned as a visual 2x2 grid of action tiles with icons, hover effects,
 * and subtle background accents. More engaging than plain button stacks.
 */

import { useRouter } from "@tanstack/react-router";
import {
  BarChart3Icon,
  FileTextIcon,
  LayoutTemplateIcon,
  UploadIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickActionItem {
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  to: string;
  search?: Record<string, unknown>;
}

interface QuickActionsProps {
  slug: string;
}

export function QuickActions({ slug }: QuickActionsProps): React.ReactElement {
  const router = useRouter();

  const actions: QuickActionItem[] = [
    {
      label: "Upload",
      description: "New document",
      icon: UploadIcon,
      iconBg: "bg-brand-50 dark:bg-brand-50",
      iconColor: "text-primary",
      to: "/$slug/documents",
      search: { folderId: undefined },
    },
    {
      label: "Templates",
      description: "Use a template",
      icon: LayoutTemplateIcon,
      iconBg: "bg-info-surface",
      iconColor: "text-info",
      to: "/$slug/templates",
      search: { folderId: undefined },
    },
    {
      label: "Documents",
      description: "View all",
      icon: FileTextIcon,
      iconBg: "bg-success-surface",
      iconColor: "text-success",
      to: "/$slug/documents",
      search: { folderId: undefined },
    },
    {
      label: "Analytics",
      description: "View insights",
      icon: BarChart3Icon,
      iconBg: "bg-warning-surface",
      iconColor: "text-warning",
      to: "/$slug/analytics",
    },
  ];

  return (
    <Card
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "350ms",
      }}
    >
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Get started quickly</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className={cn(
                  "group flex flex-col items-center gap-2 rounded-xl p-4",
                  "bg-secondary/50 hover:bg-secondary",
                  "transition-colors duration-[var(--duration-default)] ease-[var(--ease-enter)]",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                )}
                onClick={() =>
                  router.navigate({
                    to: action.to,
                    params: { slug },
                    search: action.search as Record<string, string | undefined>,
                  })
                }
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    action.iconBg
                  )}
                >
                  <Icon className={cn("h-5 w-5", action.iconColor)} />
                </div>
                <div className="text-center">
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-muted-foreground block text-[11px]">
                    {action.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
