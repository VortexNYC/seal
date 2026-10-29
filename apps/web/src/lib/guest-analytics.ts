import { getPosthog, withPosthog } from "@/lib/posthog-client";
import { useEffect } from "react";

import { isGuestAnalyticsSurface } from "@/lib/posthog-proxy";

type GuestAnalyticsClient = {
  opt_out_capturing?: () => void;
  opt_in_capturing?: () => void;
  stopSessionRecording?: () => void;
  startSessionRecording?: () => void;
  set_config?: (config: {
    disable_session_recording?: boolean;
    disable_surveys?: boolean;
    enable_heatmaps?: boolean;
  }) => void;
};

/**
 * SEA-73 — guest surfaces (`/sign/*`, `/verify/*`) show signer email, name,
 * and document titles. Disable session recording / surveys / heatmaps so that
 * PII never lands in Replay. Product funnel events (signature_viewed,
 * signing_auth_verified, signature_completed, signature_declined) stay allowed
 * with `person_profiles: identified_only` and no identify() call — properties
 * must be IDs only (never email/name/title/free-text reasons).
 */
export function muteGuestAnalytics(client?: GuestAnalyticsClient): void {
  const target = client ?? getPosthog();
  if (!target) {
    withPosthog((posthog) => muteGuestAnalytics(posthog));
    return;
  }
  target.set_config?.({
    disable_session_recording: true,
    disable_surveys: true,
    enable_heatmaps: false,
  });
  target.stopSessionRecording?.();
}

/** Re-enable recording after an authenticated identity is established. */
export function unmuteAuthenticatedAnalytics(
  client?: GuestAnalyticsClient
): void {
  const target = client ?? getPosthog();
  if (!target) {
    withPosthog((posthog) => unmuteAuthenticatedAnalytics(posthog));
    return;
  }
  target.opt_in_capturing?.();
  target.set_config?.({
    disable_session_recording: false,
    disable_surveys: false,
    enable_heatmaps: true,
  });
  target.startSessionRecording?.();
}

export function useGuestAnalyticsMute(): void {
  useEffect(() => {
    muteGuestAnalytics();
  }, []);
}

export { isGuestAnalyticsSurface };
