import { useAuth, Waitlist } from "@clerk/clerk-react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo } from "react";

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
  const { isSignedIn, isLoaded } = useAuth();
  const appearance = useMemo(
    () => getClerkAuthAppearance(resolvedTheme === "dark"),
    [resolvedTheme],
  );

  if (!isLoaded) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  return <Waitlist appearance={appearance} />;
}
