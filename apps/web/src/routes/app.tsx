import { SignedIn, SignedOut, useOrganization } from "@clerk/clerk-react";
import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import Loader from "@/components/loader";
import { buildOrganizationPath } from "@/lib/organization-path";
import { shouldWaitForOrganizationSync } from "@/lib/organization-sync";

export const Route = createFileRoute("/app")({
  component: AppRedirect,
});

function AppRedirect() {
  return (
    <>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
      <SignedIn>
        <AuthenticatedRedirect />
      </SignedIn>
    </>
  );
}

function AuthenticatedRedirect() {
  const { isLoaded: isClerkLoaded, organization: clerkOrganization } = useOrganization();
  const organizationStatus = useQuery(api.check_membership.hasOrganization);
  const ensureActiveOrganization = useMutation(api.check_membership.ensureActiveOrganization);
  const recoverOrganizationSyncFromClerk = useAction(
    api.check_membership.recoverOrganizationSyncFromClerk,
  );
  const [isFixingOrg, setIsFixingOrg] = useState(false);
  const [isRecoveringOrgSync, setIsRecoveringOrgSync] = useState(false);
  const [hasAttemptedRecovery, setHasAttemptedRecovery] = useState(false);
  const [fixedSlug, setFixedSlug] = useState<string | null>(null);

  const isLoading = organizationStatus === undefined;
  const hasOrganization = organizationStatus?.hasOrganization ?? false;
  const activeOrganizationSlug = fixedSlug ?? organizationStatus?.activeOrganizationSlug ?? null;
  const needsActiveOrgFix = organizationStatus?.needsActiveOrgFix ?? false;
  const isWaitingForOrganizationSync = shouldWaitForOrganizationSync({
    isClerkLoaded,
    hasClerkActiveOrganization: clerkOrganization !== null,
    hasOrganization,
    activeOrganizationSlug,
    hasAttemptedRecovery,
  });

  // Auto-fix activeOrganizationId if user has membership but no active org set
  useEffect(() => {
    if (!isLoading && needsActiveOrgFix && !isFixingOrg && !fixedSlug) {
      setIsFixingOrg(true);
      ensureActiveOrganization({})
        .then((result) => {
          if (result.success && result.activeOrganizationSlug) {
            setFixedSlug(result.activeOrganizationSlug);
          }
        })
        .catch((error) => {
          console.error("Failed to fix active organization:", error);
        })
        .finally(() => {
          setIsFixingOrg(false);
        });
    }
  }, [isLoading, needsActiveOrgFix, isFixingOrg, fixedSlug, ensureActiveOrganization]);

  // Recover user/org/membership sync when Clerk already has an active organization
  useEffect(() => {
    if (
      !isWaitingForOrganizationSync ||
      !clerkOrganization?.id ||
      isRecoveringOrgSync ||
      fixedSlug ||
      isFixingOrg
    ) {
      return;
    }

    setIsRecoveringOrgSync(true);

    recoverOrganizationSyncFromClerk({ clerkOrganizationId: clerkOrganization.id })
      .then((result) => {
        if (result.success && result.activeOrganizationSlug) {
          setFixedSlug(result.activeOrganizationSlug);
          return;
        }

        console.error("Failed to recover organization sync:", result.reason ?? "Unknown error");
      })
      .catch((error) => {
        console.error("Failed to recover organization sync:", error);
      })
      .finally(() => {
        setHasAttemptedRecovery(true);
        setIsRecoveringOrgSync(false);
      });
  }, [
    clerkOrganization?.id,
    fixedSlug,
    isFixingOrg,
    isRecoveringOrgSync,
    isWaitingForOrganizationSync,
    recoverOrganizationSyncFromClerk,
  ]);

  // Show loading state while checking authentication or fixing organization
  if (isLoading || isFixingOrg || isRecoveringOrgSync || isWaitingForOrganizationSync) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-muted-foreground mt-4">
            {isFixingOrg || isRecoveringOrgSync || isWaitingForOrganizationSync
              ? "Setting up your workspace..."
              : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to their workspace
  if (activeOrganizationSlug) {
    return <Navigate to={buildOrganizationPath(activeOrganizationSlug, "/home")} replace />;
  }

  // Fallback - redirect to onboarding if no organization
  return <Navigate to="/onboarding/choose-organization" replace />;
}
