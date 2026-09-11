import { AuthProvider, SignInForm } from "@vortexnyc/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";
import type { AnyAuthClient } from "@vortexnyc/better-auth-ui";

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
  const { token, redirect } = Route.useSearch();

  const forceRedirectUrl = redirect
    ? redirect
    : token
      ? `/accept-invite?token=${encodeURIComponent(token)}`
      : "/app";

  if (betterAuthClient === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  const authClient = betterAuthClient;

  const client: AnyAuthClient = {
    useSession: () => authClient.useSession(),
    signOut: () => authClient.signOut(),
    signIn: {
      email: (args) => authClient.signIn.email(args),
      ...(authClient.signIn.social !== undefined
        ? {
            social: (args) => authClient.signIn.social(args),
          }
        : {}),
    },
    signUp: {
      email: (args) => authClient.signUp.email(args),
    },
  };

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
