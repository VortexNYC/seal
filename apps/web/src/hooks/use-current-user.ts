/**
 * Compatibility current-user adapter over vortex-auth's useAppUser (SEA-606).
 *
 * Prefer `useAppUser` from `@/lib/auth-runtime.better-auth` for new code.
 * This adapter maps legacy profile-shaped fields (firstName/lastName/
 * emailAddresses) so existing call sites stay a one-line import alias:
 *
 *   import { useCurrentUser as useUser } from "@/hooks/use-current-user";
 *
 * Fields not on Better-Auth identity (imageUrl, createdAt) stay undefined;
 * avatar UIs fall back to initials.
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
      emailAddresses: primaryEmail
        ? [{ emailAddress: primaryEmail.emailAddress }]
        : [],
    };
  }, [user]);

  return { user: mapped, isLoaded, isSignedIn };
}
