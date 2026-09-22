import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, SignInForm } from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
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
  const { token, redirect } = Route.useSearch();
  const client = getBetterAuthUiClient();

  const forceRedirectUrl = redirect
    ? redirect
    : token
      ? `/accept-invite?token=${encodeURIComponent(token)}`
      : "/app";

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <AuthProvider client={client}>
      <SignInForm
        redirectTo={forceRedirectUrl}
        forgotPasswordHref="/forgot-password"
        signUpUrl="/sign-up"
        providers={[]}
      />
    </AuthProvider>
  );
}
