import type { PostHog } from "posthog-js";
import { useSyncExternalStore } from "react";

import { isGuestAnalyticsSurface } from "./posthog-proxy";

/**
 * Deferred PostHog client — `posthog-js` (~334KB) stays off the critical path.
 * The module loads on idle after first paint; captures fired earlier queue and
 * flush once the client is ready. `usePostHog()` mirrors the posthog-js/react
 * hook so components re-render when the client arrives.
 */

type PostHogCall = (posthog: PostHog) => void;

let client: PostHog | null = null;
let bootPromise: Promise<PostHog | null> | null = null;
const pendingCalls: PostHogCall[] = [];
const listeners = new Set<() => void>();

export function getPosthog(): PostHog | null {
  return client;
}

/**
 * Run `call` against the client — immediately when loaded, queued otherwise.
 * Queuing also triggers boot so imperative captures (boundary errors, funnel
 * events) never wait for the idle pass.
 */
export function withPosthog(call: PostHogCall): void {
  if (client) {
    call(client);
    return;
  }
  pendingCalls.push(call);
  schedulePosthogBoot();
}

export function capturePosthogEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  withPosthog((posthog) => posthog.capture(event, properties));
}

export function usePostHog(): PostHog | null {
  return useSyncExternalStore(
    subscribePosthog,
    () => client,
    () => null
  );
}

function subscribePosthog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function schedulePosthogBoot(): void {
  bootPromise ??= bootPosthog();
}

/** Test seam — inject a stub client without touching posthog-js. */
export function setPosthogClientForTest(next: PostHog | null): void {
  client = next;
  for (const listener of listeners) listener();
}

async function bootPosthog(): Promise<PostHog | null> {
  const rawKey: unknown = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  const key = typeof rawKey === "string" ? rawKey : "";
  if (!key) return null;

  const { default: posthog } = await import("posthog-js");
  const guestSurface = isGuestAnalyticsSurface(window.location.pathname);

  posthog.init(key, {
    defaults: "2026-01-30",
    api_host: "/ingest",
    ui_host: "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    secure_cookie: true,
    enable_heatmaps: !guestSurface,
    // Replay console logs stay off — signer PII can appear in app logs.
    enable_recording_console_log: false,
    // Web vitals + resource timing for sender SPA performance (project Opt-in).
    capture_performance: true,
    // Unhandled errors + promise rejections → Error Tracking. Project setting
    // autocapture_exceptions_opt_in must also be true (server-side kill switch).
    capture_exceptions: true,
    // SEA-73: no Replay/surveys on /sign or /verify. Funnel events still capture
    // anonymously (person_profiles: identified_only; no identify on guests).
    disable_session_recording: guestSurface,
    disable_surveys: guestSurface,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    debug: import.meta.env.MODE === "development",
  });

  client = posthog;
  for (const call of pendingCalls.splice(0)) call(posthog);
  for (const listener of listeners) listener();
  return posthog;
}
