import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy-load Sanity Studio to avoid SSR issues (Studio requires browser APIs)
const SanityStudio = lazy(() =>
  import("sanity").then((mod) =>
    import("../../sanity.config").then((config) => ({
      default: () => <mod.Studio config={config.default} />,
    })),
  ),
);

export const Route = createFileRoute("/studio")({
  component: StudioRouteComponent,
  head: () => ({
    meta: [
      { title: "Seal Studio" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function StudioRouteComponent() {
  return (
    <Suspense fallback={<StudioLoadingFallback />}>
      <SanityStudio />
    </Suspense>
  );
}

function StudioLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-zinc-400">Loading Studio...</div>
    </div>
  );
}
