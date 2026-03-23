export interface OrganizationSyncState {
  isClerkLoaded: boolean;
  hasClerkActiveOrganization: boolean;
  hasOrganization: boolean;
  activeOrganizationSlug: string | null;
  hasAttemptedRecovery?: boolean;
}

export function shouldWaitForOrganizationSync(state: OrganizationSyncState): boolean {
  if (state.hasAttemptedRecovery) {
    return false;
  }

  if (!state.isClerkLoaded || !state.hasClerkActiveOrganization) {
    return false;
  }

  return !state.hasOrganization || !state.activeOrganizationSlug;
}
