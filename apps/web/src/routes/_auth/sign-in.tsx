import { SignIn } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheckIcon } from "lucide-react";

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
      <SignIn
        routing="virtual"
        signUpUrl="/waitlist"
        appearance={getClerkAuthAppearance(resolvedTheme === "dark")}
      />
      <p className="text-muted-foreground mt-4 flex items-center justify-center gap-1.5 text-xs">
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        Secure sign-in
      </p>
    </>
  );
}
