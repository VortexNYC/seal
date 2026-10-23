import { Button } from "@cloudflare/kumo/components/button";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider, SignInForm } from "@vortex-api/better-auth-ui";

import { AUTH_FORM_CARD_CLASS } from "@/lib/auth-form";
import { betterAuthClient } from "@/lib/better-auth";
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
    return (
      <Text as="p" size="sm">
        Auth client not configured.
      </Text>
    );
  }

  return (
    <AuthProvider client={client}>
      <div className="flex w-full max-w-md flex-col gap-3">
        <SignInForm
          className={AUTH_FORM_CARD_CLASS}
          redirectTo={forceRedirectUrl}
          forgotPasswordHref="/forgot-password"
          signUpUrl="/sign-up"
          providers={[]}
        />
        <Button
          type="button"
          variant="secondary"
          data-testid="sign-in-with-vortex"
          onClick={() => {
            void betterAuthClient?.signIn.social({
              provider: "vortex",
              callbackURL: forceRedirectUrl,
            });
          }}
        >
          Sign in with Vortex
        </Button>
      </div>
    </AuthProvider>
  );
}
