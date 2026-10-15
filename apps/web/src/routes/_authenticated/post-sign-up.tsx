import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthProvider, PostSignUp } from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { buildOrganizationPath } from "@/lib/organization-path";

interface PostSignUpSearch {
  invitation_token?: string;
  next?: string;
}

export const Route = createFileRoute("/_authenticated/post-sign-up")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): PostSignUpSearch => {
    const result: PostSignUpSearch = {};
    if (typeof search.invitation_token === "string") {
      result.invitation_token = search.invitation_token;
    }
    if (search.next === "developer") {
      result.next = "developer";
    }
    return result;
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { invitation_token: invitationToken, next } = Route.useSearch();
  const client = getBetterAuthUiClient();

  if (client === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Text as="p" size="sm">
          Auth client not configured.
        </Text>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <AuthProvider client={client}>
        <PostSignUp
          invitationId={invitationToken}
          onReady={(organization) => {
            void navigate({
              to:
                next === "developer"
                  ? buildOrganizationPath(
                      organization.slug,
                      "/settings/developer"
                    )
                  : "/app",
              replace: true,
            });
          }}
        />
      </AuthProvider>
    </div>
  );
}
