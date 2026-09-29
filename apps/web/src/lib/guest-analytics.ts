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
  }) => void;
};

/**
 * SEA-73 — guest surfaces (`/sign/*`, `/verify/*`) show signer email, name,
 * and document titles. Mute PostHog capturing + session recording so those
 * never leave the browser.
 */
export function muteGuestAnalytics(
  client: GuestAnalyticsClient = posthog
): void {
  client.set_config?.({
    disable_session_recording: true,
    disable_surveys: true,
  });
  client.stopSessionRecording?.();
  client.opt_out_capturing?.();
}

/** Re-enable capturing after an authenticated identity is established. */
export function unmuteAuthenticatedAnalytics(
  client: GuestAnalyticsClient = posthog
): void {
  client.opt_in_capturing?.();
  client.set_config?.({
    disable_session_recording: false,
    disable_surveys: false,
  });
  client.startSessionRecording?.();
}

export function useGuestAnalyticsMute(): void {
  useEffect(() => {
    muteGuestAnalytics();
  }, []);
}

export { isGuestAnalyticsSurface };
