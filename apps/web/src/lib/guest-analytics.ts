import { useEffect } from "react";
import posthog from "posthog-js";

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
 * PII never lands in Replay. Product funnel events (signature_completed, etc.)
 * stay allowed with `person_profiles: identified_only` and no identify() call.
 */
export function muteGuestAnalytics(
  client: GuestAnalyticsClient = posthog
): void {
  client.set_config?.({
    disable_session_recording: true,
    disable_surveys: true,
    enable_heatmaps: false,
  });
  client.stopSessionRecording?.();
}

/** Re-enable recording after an authenticated identity is established. */
export function unmuteAuthenticatedAnalytics(
  client: GuestAnalyticsClient = posthog
): void {
  client.opt_in_capturing?.();
  client.set_config?.({
    disable_session_recording: false,
    disable_surveys: false,
    enable_heatmaps: true,
  });
  client.startSessionRecording?.();
}

export function useGuestAnalyticsMute(): void {
  useEffect(() => {
    muteGuestAnalytics();
  }, []);
}

export { isGuestAnalyticsSurface };
