/**
 * Syncs Clerk user + organization context into Jam.dev metadata.
 * Mount once in the authenticated layout.
 */

import { useOrganization, useUser } from "@clerk/clerk-react";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { clearJamMetadata, registerJamMetadata } from "@/lib/jam";

export function useJamMetadata() {
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const location = useLocation();

  // Use refs so the metadata callback always reads fresh values
  const userRef = useRef(user);
  const orgRef = useRef(organization);
  const locationRef = useRef(location);

  userRef.current = user;
  orgRef.current = organization;
  locationRef.current = location;

  useEffect(() => {
    if (!isLoaded || !user) return;

    registerJamMetadata(() => ({
      userId: userRef.current?.id,
      email: userRef.current?.primaryEmailAddress?.emailAddress,
      name: userRef.current?.fullName ?? undefined,
      organizationId: orgRef.current?.id,
      organizationName: orgRef.current?.name,
      route: locationRef.current.pathname,
    }));

    return () => {
      clearJamMetadata();
    };
  }, [isLoaded, user]);
}
