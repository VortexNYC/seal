import { createFileRoute } from "@tanstack/react-router";
import { VortexAuthSignInPage, useVortexAuth } from "@vortexnyc/auth/react";

import { betterAuthClient } from "@/lib/better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

interface SignInSearch {
  token?: string;
  redirect?: string;
}

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signIn, "/sign-in"),
  validateSearch: (search: Record<string, unknown>): SignInSearch => {
    const result: SignInSearch = {};
    if (typeof search.token === "string") {
      result.token = search.token;
    }
    if (typeof search.redirect === "string") {
      result.redirect = search.redirect;
    }
    return result;
  },
});

function RouteComponent() {
  const auth = useVortexAuth(betterAuthClient);
  const { token, redirect } = Route.useSearch();

  const forceRedirectUrl = redirect
    ? redirect
    : token
      ? `/accept-invite?token=${encodeURIComponent(token)}`
      : "/app";

  return (
    <VortexAuthSignInPage
      auth={auth}
      authClient={betterAuthClient}
      forceRedirectUrl={forceRedirectUrl}
      forgotPasswordHref="/forgot-password"
      signUpUrl="/sign-up"
    />
  );
}
