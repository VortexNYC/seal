import { createFileRoute } from "@tanstack/react-router";
import { VortexAuthSignUpPage, useVortexAuth } from "@vortexnyc/auth/react";

import { betterAuthClient } from "@/lib/better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

interface SignUpSearch {
  token?: string;
}

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signUp, "/sign-up"),
  validateSearch: (search: Record<string, unknown>): SignUpSearch => {
    const result: SignUpSearch = {};
    if (typeof search.token === "string") {
      result.token = search.token;
    }
    return result;
  },
});

function RouteComponent() {
  const auth = useVortexAuth(betterAuthClient);
  const { token } = Route.useSearch();

  const forceRedirectUrl = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : "/post-sign-up";

  return (
    <VortexAuthSignUpPage
      auth={auth}
      authClient={betterAuthClient}
      forceRedirectUrl={forceRedirectUrl}
      signInUrl="/sign-in"
    />
  );
}
