import type { ReactElement } from "react";
import { lazy } from "react";

const StudioApp = lazy(async () => {
  const [sanityModule, studioConfigModule] = await Promise.all([
    import("sanity"),
    import("../../sanity.config"),
  ]);

  function StudioRenderer(): ReactElement {
    return <sanityModule.Studio config={studioConfigModule.default} />;
  }

  return { default: StudioRenderer };
});

export function StudioClient(): ReactElement {
  return <StudioApp />;
}
