import { Waitlist } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { useTheme } from "@/components/theme-provider";
import { getClerkAuthAppearance } from "@/lib/clerk-auth-theme";
import { getCanonicalUrl, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/waitlist")({
  component: RouteComponent,
  head: () => ({
    meta: [
      { title: pageSEO.waitlist.title },
      { name: "description", content: pageSEO.waitlist.description },
      { property: "og:title", content: pageSEO.waitlist.title },
      { property: "og:description", content: pageSEO.waitlist.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: getCanonicalUrl("/waitlist") }],
  }),
});

function RouteComponent() {
  const { resolvedTheme } = useTheme();

  return <Waitlist appearance={getClerkAuthAppearance(resolvedTheme === "dark")} />;
}
