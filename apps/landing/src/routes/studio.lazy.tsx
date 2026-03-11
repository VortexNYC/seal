import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const StudioClient = lazy(async () => {
  const mod = await import("~/components/studio-client");
  return { default: mod.StudioClient };
});

export const Route = createLazyFileRoute("/studio")({
  component: StudioRouteComponent,
});

function StudioRouteComponent() {
  return (
    <ClientOnly fallback={<StudioLoadingFallback />}>
      <Suspense fallback={<StudioLoadingFallback />}>
        <StudioClient />
      </Suspense>
    </ClientOnly>
  );
}

function StudioLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-zinc-400">Loading Studio...</div>
    </div>
  );
}
