export interface OrganizationSyncState {
  isClerkLoaded: boolean;
  hasClerkActiveOrganization: boolean;
  hasOrganization: boolean;
  activeOrganizationSlug: string | null;
}

export function shouldWaitForOrganizationSync(state: OrganizationSyncState): boolean {
  if (!state.isClerkLoaded || !state.hasClerkActiveOrganization) {
    return false;
  }

  return !state.hasOrganization || !state.activeOrganizationSlug;
}
