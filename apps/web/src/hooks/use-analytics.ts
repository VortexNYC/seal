import { usePostHog } from "posthog-js/react";
import { useCallback, useRef } from "react";

/**
 * PostHog Analytics Hook - provides type-safe event tracking, user identification,
 * and organization group analytics.
 *
 * @example
 * const { track, identify, group, reset } = useAnalytics();
 * track.documentUploaded({ fileSize: 1024, pageCount: 5 });
 * identify({ userId: 'user_123', email: 'user@example.com' });
 * group({ organizationId: 'org_123', name: 'Acme Inc', plan: 'pro' });
 */

interface UserIdentity {
  userId: string;
  email?: string;
  name?: string;
  createdAt?: string;
}

interface OrganizationGroup {
  organizationId: string;
  name?: string;
  slug?: string;
  plan?: string;
  memberCount?: number;
}

interface DocumentProperties {
  documentId?: string;
  fileSize?: number;
  pageCount?: number;
  fileType?: string;
  workflowStatus?: string;
}

interface TemplateProperties {
  templateId?: string;
  templateName?: string;
  fieldCount?: number;
}

interface SignatureProperties {
  documentId?: string;
  recipientId?: string;
  fieldType?: string;
  fieldCount?: number;
}

interface TeamProperties {
  memberId?: string;
  role?: string;
  inviteCount?: number;
}

interface SettingsProperties {
  section?: string;
  field?: string;
}

interface SearchProperties {
  query?: string;
  resultCount?: number;
  filters?: Record<string, string | boolean>;
}

interface WebhookProperties {
  endpointId?: string;
  eventTypes?: string[];
}

export function useAnalytics() {
  const posthog = usePostHog();
  const identifiedUserRef = useRef<string | null>(null);
  const identifiedOrgRef = useRef<string | null>(null);

  /**
   * Identify a user in PostHog. Should be called once when user authenticates.
   * Subsequent calls with the same userId will be ignored to prevent duplicate calls.
   */
  const identify = useCallback(
    (user: UserIdentity) => {
      if (!posthog) return;
      if (identifiedUserRef.current === user.userId) return;

      posthog.identify(user.userId, {
        email: user.email,
        name: user.name,
        created_at: user.createdAt,
      });
      identifiedUserRef.current = user.userId;
    },
    [posthog],
  );

  /**
   * Associate user with an organization group for B2B analytics.
   * Enables analysis by organization and ties events to workspaces.
   */
  const group = useCallback(
    (org: OrganizationGroup) => {
      if (!posthog) return;
      if (identifiedOrgRef.current === org.organizationId) return;

      posthog.group("organization", org.organizationId, {
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        member_count: org.memberCount,
      });
      identifiedOrgRef.current = org.organizationId;
    },
    [posthog],
  );

  /**
   * Reset PostHog identity. Should be called on logout to clear user data
   * and start a fresh anonymous session.
   */
  const reset = useCallback(() => {
    if (!posthog) return;
    posthog.reset();
    identifiedUserRef.current = null;
    identifiedOrgRef.current = null;
  }, [posthog]);

  const documentUploaded = useCallback(
    (properties?: DocumentProperties) => {
      posthog?.capture("document_uploaded", properties);
    },
    [posthog],
  );

  const documentSent = useCallback(
    (properties?: DocumentProperties & { recipientCount?: number }) => {
      posthog?.capture("document_sent", properties);
    },
    [posthog],
  );

  const documentCancelled = useCallback(
    (properties?: DocumentProperties) => {
      posthog?.capture("document_cancelled", properties);
    },
    [posthog],
  );

  const documentDeleted = useCallback(
    (properties?: DocumentProperties) => {
      posthog?.capture("document_deleted", properties);
    },
    [posthog],
  );

  const documentDownloaded = useCallback(
    (properties?: DocumentProperties) => {
      posthog?.capture("document_downloaded", properties);
    },
    [posthog],
  );

  const documentShared = useCallback(
    (
      properties?: DocumentProperties & {
        sharingMode?: string;
        sharedWith?: number;
      },
    ) => {
      posthog?.capture("document_shared", properties);
    },
    [posthog],
  );

  const documentViewed = useCallback(
    (properties?: DocumentProperties) => {
      posthog?.capture("document_viewed", properties);
    },
    [posthog],
  );

  const templateCreated = useCallback(
    (properties?: TemplateProperties) => {
      posthog?.capture("template_created", properties);
    },
    [posthog],
  );

  const templateUsed = useCallback(
    (properties?: TemplateProperties) => {
      posthog?.capture("template_used", properties);
    },
    [posthog],
  );

  const templateEdited = useCallback(
    (properties?: TemplateProperties) => {
      posthog?.capture("template_edited", properties);
    },
    [posthog],
  );

  const templateDeleted = useCallback(
    (properties?: TemplateProperties) => {
      posthog?.capture("template_deleted", properties);
    },
    [posthog],
  );

  const signatureCompleted = useCallback(
    (properties?: SignatureProperties) => {
      posthog?.capture("signature_completed", properties);
    },
    [posthog],
  );

  const signatureDeclined = useCallback(
    (properties?: SignatureProperties & { reason?: string }) => {
      posthog?.capture("signature_declined", properties);
    },
    [posthog],
  );

  const signatureFieldFilled = useCallback(
    (properties?: SignatureProperties) => {
      posthog?.capture("signature_field_filled", properties);
    },
    [posthog],
  );

  const teamMemberInvited = useCallback(
    (properties?: TeamProperties) => {
      posthog?.capture("team_member_invited", properties);
    },
    [posthog],
  );

  const teamMemberRoleChanged = useCallback(
    (properties?: TeamProperties & { previousRole?: string }) => {
      posthog?.capture("team_member_role_changed", properties);
    },
    [posthog],
  );

  const teamMemberRemoved = useCallback(
    (properties?: TeamProperties) => {
      posthog?.capture("team_member_removed", properties);
    },
    [posthog],
  );

  const settingsUpdated = useCallback(
    (properties?: SettingsProperties) => {
      posthog?.capture("settings_updated", properties);
    },
    [posthog],
  );

  const profileUpdated = useCallback(
    (properties?: { fields?: string[] }) => {
      posthog?.capture("profile_updated", properties);
    },
    [posthog],
  );

  const notificationPreferencesUpdated = useCallback(
    (properties?: { channel?: string; enabled?: boolean }) => {
      posthog?.capture("notification_preferences_updated", properties);
    },
    [posthog],
  );

  const searchPerformed = useCallback(
    (properties?: SearchProperties) => {
      posthog?.capture("search_performed", properties);
    },
    [posthog],
  );

  const filterApplied = useCallback(
    (properties?: { filterType?: string; filterValue?: string }) => {
      posthog?.capture("filter_applied", properties);
    },
    [posthog],
  );

  const webhookCreated = useCallback(
    (properties?: WebhookProperties) => {
      posthog?.capture("webhook_created", properties);
    },
    [posthog],
  );

  const webhookTested = useCallback(
    (properties?: WebhookProperties & { success?: boolean }) => {
      posthog?.capture("webhook_tested", properties);
    },
    [posthog],
  );

  const billingPageViewed = useCallback(() => {
    posthog?.capture("billing_page_viewed");
  }, [posthog]);

  const upgradeInitiated = useCallback(
    (properties?: { currentPlan?: string; targetPlan?: string }) => {
      posthog?.capture("upgrade_initiated", properties);
    },
    [posthog],
  );

  const apiKeyCreated = useCallback(
    (properties?: { keyName?: string }) => {
      posthog?.capture("api_key_created", properties);
    },
    [posthog],
  );

  const apiKeyRevoked = useCallback(
    (properties?: { keyName?: string }) => {
      posthog?.capture("api_key_revoked", properties);
    },
    [posthog],
  );

  const integrationConnected = useCallback(
    (properties?: { integrationName?: string }) => {
      posthog?.capture("integration_connected", properties);
    },
    [posthog],
  );

  const integrationDisconnected = useCallback(
    (properties?: { integrationName?: string }) => {
      posthog?.capture("integration_disconnected", properties);
    },
    [posthog],
  );

  const capture = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      posthog?.capture(eventName, properties);
    },
    [posthog],
  );

  return {
    track: {
      documentUploaded,
      documentSent,
      documentCancelled,
      documentDeleted,
      documentDownloaded,
      documentShared,
      documentViewed,
      templateCreated,
      templateUsed,
      templateEdited,
      templateDeleted,
      signatureCompleted,
      signatureDeclined,
      signatureFieldFilled,
      teamMemberInvited,
      teamMemberRoleChanged,
      teamMemberRemoved,
      settingsUpdated,
      profileUpdated,
      notificationPreferencesUpdated,
      searchPerformed,
      filterApplied,
      webhookCreated,
      webhookTested,
      billingPageViewed,
      upgradeInitiated,
      apiKeyCreated,
      apiKeyRevoked,
      integrationConnected,
      integrationDisconnected,
    },
    identify,
    group,
    reset,
    capture,
    posthog,
  };
}
