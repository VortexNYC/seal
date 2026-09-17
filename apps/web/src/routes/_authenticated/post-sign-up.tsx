import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import Loader from "@/components/loader";
import { betterAuthClient } from "@/lib/better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";

interface PostSignUpSearch {
  invitation_token?: string;
  next?: string;
}

interface SessionWithActiveOrganization {
  session?: {
    activeOrganizationId?: string | null;
  };
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

  const { data: sessionData, isPending: isSessionPending } =
    betterAuthClient?.useSession() ?? {
      data: null,
      isPending: false,
    };

  const { data: organizations, isPending: isOrganizationsPending } = useQuery({
    queryKey: ["auth", "organization", "list"],
    queryFn: async () => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.list();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data ?? [];
    },
    enabled: betterAuthClient !== null,
  });

  const setActive = useMutation({
    mutationFn: async (organizationId: string) => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.setActive({
        organizationId,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  const acceptInvitation = useMutation({
    mutationFn: async (token: string) => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.acceptInvitation({
        invitationId: token,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  useEffect(() => {
    if (
      !sessionData ||
      isOrganizationsPending ||
      organizations === undefined ||
      organizations === null
    ) {
      return;
    }

    const currentOrganizations = organizations;
    const typedSession = sessionData as SessionWithActiveOrganization;

    const toDestination = (slug: string | null | undefined) =>
      next === "developer" && slug
        ? buildOrganizationPath(slug, "/settings/developer")
        : "/app";

    async function finish() {
      if (invitationToken) {
        await acceptInvitation.mutateAsync(invitationToken);
        void navigate({ to: "/app", replace: true });
        return;
      }

      if (typedSession.session?.activeOrganizationId) {
        const active = currentOrganizations.find(
          (o) => o.id === typedSession.session?.activeOrganizationId
        );
        void navigate({ to: toDestination(active?.slug), replace: true });
        return;
      }

      if (currentOrganizations.length > 0) {
        const first = currentOrganizations[0];
        if (first?.id) {
          await setActive.mutateAsync(first.id);
        }
        void navigate({ to: toDestination(first?.slug), replace: true });
        return;
      }

      void navigate({
        to: "/onboarding/choose-organization",
        search: next === "developer" ? { next } : {},
        replace: true,
      });
    }

    void finish();
  }, [
    sessionData,
    isOrganizationsPending,
    organizations,
    invitationToken,
    next,
    acceptInvitation,
    setActive,
    navigate,
  ]);

  if (betterAuthClient === null || isSessionPending || isOrganizationsPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader />
    </div>
  );
}
