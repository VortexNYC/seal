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
    <div className="w-full space-y-6">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        Sign in to Seal
      </h1>
      <SignIn
        routing="virtual"
        signUpUrl="/waitlist"
        appearance={getClerkAuthAppearance(resolvedTheme === "dark")}
      />
    </div>
  );
}
