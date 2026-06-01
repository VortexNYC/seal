/**
 * Clerk-compatible current-user adapter over vortex-auth's useAppUser.
 *
 * vortex-auth's `useAppUser()` returns a minimal user
 * ({ id, username, fullName, primaryEmailAddress }). Seal's existing call
 * sites read Clerk-shaped fields (firstName, lastName, imageUrl,
 * emailAddresses[]). This adapter derives/maps those so the migration is a
 * one-line import-alias change per consumer instead of a rewrite:
 *
 *   - import { useUser } from "@clerk/clerk-react";
 *   + import { useCurrentUser as useUser } from "@/hooks/use-current-user";
 *
 * Fields not provided by Better-Auth identity (imageUrl, createdAt) are
 * undefined; avatar UIs fall back to initials. Account avatar, if needed,
 * comes from Convex separately.
 */
import { useMemo } from "react";

import { useAppUser } from "@/lib/auth-runtime.better-auth";

export type CurrentUser = {
  id: string;
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | undefined;
  createdAt: number | undefined;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: Array<{ emailAddress: string }>;
};

export function useCurrentUser(): {
  user: CurrentUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
} {
  const { user, isLoaded, isSignedIn } = useAppUser();

  const mapped = useMemo<CurrentUser | null>(() => {
    if (!user) {
      return null;
    }
    const fullName = user.fullName;
    const [firstName, ...rest] = (fullName ?? "").trim().split(/\s+/);
    const primaryEmail = user.primaryEmailAddress;
    return {
      id: user.id,
      username: user.username,
      fullName,
      firstName: firstName || null,
      lastName: rest.length > 0 ? rest.join(" ") : null,
      imageUrl: undefined,
      createdAt: undefined,
      primaryEmailAddress: primaryEmail,
      emailAddresses: primaryEmail ? [{ emailAddress: primaryEmail.emailAddress }] : [],
    };
  }, [user]);

  return { user: mapped, isLoaded, isSignedIn };
}
