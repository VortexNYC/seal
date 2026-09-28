import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * SEA-73 — guest surfaces (`/sign/*`, `/verify/*`) show signer email, name,
 * and document titles. Mute PostHog capturing + session recording so those
 * never leave the browser.
 */
export function muteGuestAnalytics(
  client: {
    opt_out_capturing?: () => void;
    stopSessionRecording?: () => void;
  } = posthog
): void {
  client.opt_out_capturing?.();
  client.stopSessionRecording?.();
}

/** Re-enable capturing after an authenticated identity is established. */
export function unmuteAuthenticatedAnalytics(
  client: {
    opt_in_capturing?: () => void;
  } = posthog
): void {
  client.opt_in_capturing?.();
}

export function useGuestAnalyticsMute(): void {
  useEffect(() => {
    muteGuestAnalytics();
  }, []);
}
