import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { useTheme } from "@/components/theme-provider";
import { getClerkAuthAppearance } from "@/lib/clerk-auth-theme";
import { getCanonicalUrl, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
  head: () => ({
    meta: [
      { title: pageSEO.signUp.title },
      { name: "description", content: pageSEO.signUp.description },
      { property: "og:title", content: pageSEO.signUp.title },
      { property: "og:description", content: pageSEO.signUp.description },
    ],
    links: [{ rel: "canonical", href: getCanonicalUrl("/sign-up") }],
  }),
});

function RouteComponent() {
  const { resolvedTheme } = useTheme();

  return <SignUp routing="virtual" appearance={getClerkAuthAppearance(resolvedTheme === "dark")} />;
}
