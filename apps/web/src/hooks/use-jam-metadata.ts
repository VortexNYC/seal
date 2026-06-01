/**
 * Syncs the current user context into Jam.dev metadata.
 * Mount once in the authenticated layout.
 */

import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { clearJamMetadata, registerJamMetadata } from "@/lib/jam";

export function useJamMetadata() {
  const { user, isLoaded } = useCurrentUser();
  const location = useLocation();

  // Use refs so the metadata callback always reads fresh values
  const userRef = useRef(user);
  const locationRef = useRef(location);

  userRef.current = user;
  locationRef.current = location;

  useEffect(() => {
    if (!isLoaded || !user) return;

    registerJamMetadata(() => ({
      userId: userRef.current?.id,
      email: userRef.current?.primaryEmailAddress?.emailAddress,
      name: userRef.current?.fullName ?? undefined,
      route: locationRef.current.pathname,
    }));

    return () => {
      clearJamMetadata();
    };
  }, [isLoaded, user]);
}
