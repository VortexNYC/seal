/**
 * Dashboard Quick Actions — compact link list (SEA-96).
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useRouter } from "@tanstack/react-router";
import { FileText as FileTextIcon, type Icon, Layout as LayoutTemplateIcon, UploadSimple as UploadIcon } from "@phosphor-icons/react";

interface QuickActionItem {
  label: string;
  icon: Icon;
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
        <Text as="h3" size="sm">
          Start
        </Text>
      </LayerCard.Secondary>
      <LayerCard.Primary className="mx-1.5 mb-1.5 flex flex-col gap-1 px-3 pb-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            className="w-full justify-start"
            icon={action.icon}
            onClick={() =>
              router.navigate({
                to: action.to,
                params: { slug },
                search: action.search,
              })
            }
          >
            {action.label}
          </Button>
        ))}
      </LayerCard.Primary>
    </LayerCard>
  );
}
