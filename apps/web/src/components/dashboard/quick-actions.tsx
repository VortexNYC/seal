/**
 * Dashboard Quick Actions — compact link list (SEA-96).
 * Neutral chrome; no rainbow tile grid.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useRouter } from "@tanstack/react-router";
import { FileTextIcon, LayoutTemplateIcon, UploadIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MOTION_PRESS } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface QuickActionItem {
  label: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string | undefined>;
}

interface QuickActionsProps {
  slug: string;
}

export function QuickActions({ slug }: QuickActionsProps): React.ReactElement {
  const router = useRouter();

  const actions: QuickActionItem[] = [
    {
      label: "Upload PDF",
      icon: UploadIcon,
      to: "/$slug/documents",
      search: { folderId: undefined },
    },
    {
      label: "Templates",
      icon: LayoutTemplateIcon,
      to: "/$slug/templates",
      search: { folderId: undefined },
    },
    {
      label: "All documents",
      icon: FileTextIcon,
      to: "/$slug/documents",
      search: { folderId: undefined },
    },
  ];

  return (
    <LayerCard>
      <LayerCard.Secondary className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold">Start</h3>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 flex flex-col gap-0.5 px-3 pb-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              className={cn(
                MOTION_PRESS,
                "text-foreground hover:bg-secondary focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              )}
              onClick={() =>
                router.navigate({
                  to: action.to,
                  params: { slug },
                  search: action.search,
                })
              }
            >
              <Icon className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate font-medium">{action.label}</span>
            </button>
          );
        })}
      </LayerCard.Primary>
    </LayerCard>
  );
}
