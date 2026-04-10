import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { useTheme } from "@/components/theme-provider";
import { getClerkAuthAppearance } from "@/lib/clerk-auth-theme";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signUp, "/sign-up"),
});

function RouteComponent() {
  const { resolvedTheme } = useTheme();

  return <SignUp appearance={getClerkAuthAppearance(resolvedTheme === "dark")} />;
}
