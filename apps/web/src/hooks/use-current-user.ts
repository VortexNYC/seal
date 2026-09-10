import { useMemo } from "react";

import { betterAuthClient } from "@/lib/better-auth";

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
  if (betterAuthClient === null) {
    return { user: null, isLoaded: false, isSignedIn: false };
  }

  const { data, isPending } = betterAuthClient.useSession();

  const mapped = useMemo<CurrentUser | null>(() => {
    if (!data?.user) {
      return null;
    }
    const fullName = data.user.name ?? null;
    const [firstName, ...rest] = (fullName ?? "").trim().split(/\s+/);
    const primaryEmail = data.user.email
      ? { emailAddress: data.user.email }
      : null;
    return {
      id: data.user.id,
      username: primaryEmail ? primaryEmail.emailAddress.split("@")[0] : null,
      fullName,
      firstName: firstName || null,
      lastName: rest.length > 0 ? rest.join(" ") : null,
      imageUrl: data.user.image ?? undefined,
      createdAt: undefined,
      primaryEmailAddress: primaryEmail,
      emailAddresses: primaryEmail ? [primaryEmail] : [],
    };
  }, [data]);

  return { user: mapped, isLoaded: !isPending, isSignedIn: !!data };
}
