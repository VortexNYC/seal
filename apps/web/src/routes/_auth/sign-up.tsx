import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, SignUpForm } from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { createPageMeta, pageSEO } from "@/lib/seo";

interface SignUpSearch {
  token?: string;
  next?: string;
}

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signUp, "/sign-up"),
  validateSearch: (search: Record<string, unknown>): SignUpSearch => {
    const result: SignUpSearch = {};
    if (typeof search.token === "string") {
      result.token = search.token;
    }
    if (search.next === "developer") {
      result.next = "developer";
    }
    return result;
  },
});

function RouteComponent() {
  const { token, next } = Route.useSearch();
  const client = getBetterAuthUiClient();

  const redirectTo = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : next === "developer"
      ? "/post-sign-up?next=developer"
      : "/post-sign-up";

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <AuthProvider client={client}>
      <SignUpForm redirectTo={redirectTo} signInUrl="/sign-in" providers={[]} />
    </AuthProvider>
  );
}
