import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  className,
  icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}): ReactElement {
  return (
    <LayerCard className={cn("flex flex-col gap-4 p-5", className)}>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {icon}
          <Text as="h2" variant="heading">
            {title}
          </Text>
        </div>
        {description ? (
          <Text variant="secondary" size="sm">
            {description}
          </Text>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </LayerCard>
  );
}
