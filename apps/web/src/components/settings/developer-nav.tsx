import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useRouter } from "@tanstack/react-router";
import type { ReactElement } from "react";

type DeveloperTab = "api-keys" | "webhooks";

export function DeveloperNav({
  slug,
  active,
}: {
  slug: string;
  active: DeveloperTab;
}): ReactElement {
  const router = useRouter();

  return (
    <nav aria-label="Developer sections">
      <Tabs
        variant="segmented"
        size="sm"
        value={active}
        onValueChange={(value) => {
          if (value !== "api-keys" && value !== "webhooks") return;
          void router.navigate({
            to:
              value === "api-keys"
                ? "/$slug/settings/developer/api-keys"
                : "/$slug/settings/developer/webhooks",
            params: { slug },
          });
        }}
        tabs={[
          { value: "api-keys", label: "API keys" },
          { value: "webhooks", label: "Webhooks" },
        ]}
      />
    </nav>
  );
}
