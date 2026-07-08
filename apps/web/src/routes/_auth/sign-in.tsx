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

  const signInProps = {
    routing: "virtual" as const,
    signUpUrl: "/waitlist",
    appearance: getClerkAuthAppearance(resolvedTheme === "dark"),
  };

  // Clerk's SignIn component accepts localization at runtime even though
  // the TypeScript types don't expose it yet.
  Object.defineProperty(signInProps, "localization", {
    value: { formButtonPrimary: "Sign in" },
    enumerable: true,
    configurable: true,
    writable: true,
  });

  return <SignIn {...signInProps} />;
}
