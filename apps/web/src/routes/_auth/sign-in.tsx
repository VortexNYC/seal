import { SignIn } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

import { useTheme } from "@/components/theme-provider";
import { getClerkAuthAppearance } from "@/lib/clerk-auth-theme";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signIn, "/sign-in"),
});

function RouteComponent() {
  const { resolvedTheme } = useTheme();

  return (
    <>
      <p className="text-muted-foreground text-center text-sm mb-4">
        Access your document workspace
      </p>
      <SignIn
        routing="virtual"
        signUpUrl="/waitlist"
        appearance={getClerkAuthAppearance(resolvedTheme === "dark")}
      />
    </>
  );
}
