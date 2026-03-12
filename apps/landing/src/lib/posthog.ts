import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;

let initialized = false;

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === "undefined") return;
  initialized = true;

  posthog.init(POSTHOG_KEY, {
    defaults: "2026-01-30",
    api_host: "/ingest",
    ui_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    secure_cookie: true,
    capture_performance: true,
    enable_heatmaps: true,
    debug: import.meta.env.MODE === "development",
  });
}
