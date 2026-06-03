/**
 * PostHogIdentify Component
 *
 * Handles automatic user identification and organization group association
 * for PostHog analytics. Should be placed in authenticated layouts where
 * user and organization context is available.
 *
 * This component doesn't render any UI - it only manages PostHog identity.
 */

import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useEffect } from "react";

import { useAnalytics } from "@/hooks/use-analytics";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";

interface PostHogIdentifyProps {
  organization: {
    _id: Id<"organizations">;
    name: string;
    slug: string;
  };
}

export function PostHogIdentify({ organization }: PostHogIdentifyProps) {
  const { user, isLoaded } = useUser();
  const { identify, group } = useAnalytics();

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Identify the user with their user id and properties
    identify({
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName ?? undefined,
    });
  }, [isLoaded, user, identify]);

  useEffect(() => {
    if (!organization._id) return;

    // Associate user with organization group for B2B analytics
    group({
      organizationId: organization._id,
      name: organization.name,
      slug: organization.slug,
    });
  }, [organization._id, organization.name, organization.slug, group]);

  // This component doesn't render anything
  return null;
}
