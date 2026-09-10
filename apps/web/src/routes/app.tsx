import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import Loader from "@/components/loader";
import { betterAuthClient } from "@/lib/better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute("/app")({
  component: AppRedirect,
});

function AppRedirect() {
  if (betterAuthClient === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }
  return <AuthenticatedRedirect />;
}

function AuthenticatedRedirect() {
  const [isFixing, setIsFixing] = useState(false);
  const [fixedSlug, setFixedSlug] = useState<string | null>(null);
  const { data: sessionData, isPending: isSessionPending } =
    betterAuthClient!.useSession();
  const {
    data: organizations,
    isPending: isListPending,
    isError: isListError,
  } = useQuery({
    queryKey: ["auth", "organization", "list"],
    queryFn: async () => {
      const result = await betterAuthClient!.organization.list();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
  const setActive = useMutation({
    mutationFn: async (slug: string) => {
      const result = await betterAuthClient!.organization.setActive({
        organizationSlug: slug,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  const activeOrganizationSlug =
    fixedSlug ?? (organizations && organizations[0]?.slug) ?? null;

  useEffect(() => {
    if (
      !organizations ||
      organizations.length === 0 ||
      isFixing ||
      fixedSlug ||
      activeOrganizationSlug
    ) {
      return;
    }
    const first = organizations[0];
    if (!first) return;
    setIsFixing(true);
    setActive.mutate(first.slug, {
      onSuccess: () => {
        setFixedSlug(first.slug);
      },
      onError: (error: unknown) => {
        console.error("Failed to set active organization:", error);
      },
      onSettled: () => {
        setIsFixing(false);
      },
    });
  }, [organizations, isFixing, fixedSlug, activeOrganizationSlug, setActive]);

  const isLoading =
    isSessionPending ||
    isListPending ||
    (organizations &&
      organizations.length > 0 &&
      !activeOrganizationSlug &&
      isFixing);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-muted-foreground mt-4">
            {isFixing ? "Setting up your workspace..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return <Navigate to="/sign-in" replace />;
  }

  if (isListError || activeOrganizationSlug === null) {
    return <Navigate to="/onboarding/choose-organization" replace />;
  }

  return (
    <Navigate
      to={buildOrganizationPath(activeOrganizationSlug, "/home")}
      replace
    />
  );
}
