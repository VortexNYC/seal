import { useEffect, useState } from "react";

import { usePostHog } from "../lib/posthog-client";

/**
 * PostHog-backed feature flags (VTX-589). Wraps posthog-js' client-side flag
 * evaluation: `isFeatureEnabled` reads the locally cached flag payload, so
 * there's no per-render network cost. Returns `undefined` while the client
 * is still booting or the flag isn't configured — callers should treat
 * "not yet loaded" as off-by-default.
 *
 * Flags are named in PostHog; no Seal-side registry to keep in sync.
 */
export function useFlag(flagKey: string): boolean | undefined {
  const posthog = usePostHog();
  const [enabled, setEnabled] = useState<boolean | undefined>(() =>
    posthog?.isFeatureEnabled(flagKey)
  );

  useEffect(() => {
    if (!posthog) {
      setEnabled(undefined);
      return;
    }
    // Re-read on boot, then again whenever PostHog reloads its flag payload.
    setEnabled(posthog.isFeatureEnabled(flagKey));
    const unsubscribe = posthog.onFeatureFlags(() => {
      setEnabled(posthog.isFeatureEnabled(flagKey));
    });
    return unsubscribe;
  }, [posthog, flagKey]);

  return enabled;
}

/**
 * Render prop for the common "show while flagged" shape.
 * `children` renders only when the flag resolves to `true`.
 */
export function FeatureFlag({
  flag,
  children,
  fallback = null,
}: {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}): React.ReactNode {
  const enabled = useFlag(flag);
  return enabled === true ? children : fallback;
}
