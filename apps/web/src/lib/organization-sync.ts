export interface OrganizationSyncState {
  isAuthLoaded: boolean;
  hasActiveOrganization: boolean;
  hasOrganization: boolean;
  activeOrganizationSlug: string | null;
  hasAttemptedRecovery?: boolean;
}

/** Returns true when the auth session has an active org but Convex has not yet mirrored it locally. */
export function shouldWaitForOrganizationSync(state: OrganizationSyncState): boolean {
  if (state.hasAttemptedRecovery) {
    return false;
  }

  if (!state.isAuthLoaded || !state.hasActiveOrganization) {
    return false;
  }

  return !state.hasOrganization || !state.activeOrganizationSlug;
}
