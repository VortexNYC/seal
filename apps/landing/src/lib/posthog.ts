import posthog from "posthog-js";

const rawPosthogKey: unknown = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_KEY =
  typeof rawPosthogKey === "string" && rawPosthogKey.length > 0
    ? rawPosthogKey
    : undefined;

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  initialized = true;
  const posthogInitOptions = {
    apiHost: "/ingest",
    uiHost: "https://us.i.posthog.com",
    autocapture: false,
    capturePageview: false,
    persistence: "localStorage+cookie" as const,
  };

  posthog.init(POSTHOG_KEY, {
    defaults: "2026-01-30",
    api_host: posthogInitOptions.apiHost,
    ui_host: posthogInitOptions.uiHost,
    autocapture: posthogInitOptions.autocapture,
    capture_pageview: posthogInitOptions.capturePageview,
    persistence: posthogInitOptions.persistence,
    person_profiles: "identified_only",
    secure_cookie: true,
    capture_performance: true,
    enable_heatmaps: true,
    debug: import.meta.env.MODE === "development",
  });
}
