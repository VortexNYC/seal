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
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">Welcome</h1>
      <SignIn
        routing="virtual"
        signUpUrl="/waitlist"
        appearance={getClerkAuthAppearance(resolvedTheme === "dark")}
      />
    </div>
  );
}
