/**
 * Capture authenticated SPA pageviews for PostHog.
 * Guest `/sign` and `/verify` surfaces stay mute (SEA-73).
 */

import { useLocation } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";

import { isGuestAnalyticsSurface } from "@/lib/posthog-proxy";

export function PostHogPageview(): null {
  const location = useLocation();
  const posthog = usePostHog();
  const lastHrefRef = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog) return;
    const pathname = location.pathname;
    if (isGuestAnalyticsSurface(pathname)) return;

    const href = location.href;
    if (lastHrefRef.current === href) return;
    lastHrefRef.current = href;

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      path: pathname,
    });
  }, [location.href, location.pathname, posthog]);

  return null;
}
