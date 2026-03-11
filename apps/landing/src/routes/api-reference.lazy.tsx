import { ClientOnly, createLazyFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ApiReferenceClient = lazy(async () => {
  const mod = await import("~/components/api-reference-client");
  return { default: mod.ApiReferenceClient };
});

export const Route = createLazyFileRoute("/api-reference")({
  component: ApiReferencePage,
});

function ApiReferencePage() {
  return (
    <ClientOnly fallback={<ApiReferenceLoadingFallback />}>
      <Suspense fallback={<ApiReferenceLoadingFallback />}>
        <ApiReferenceClient />
      </Suspense>
    </ClientOnly>
  );
}

function ApiReferenceLoadingFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white text-sm text-zinc-500">
      Loading API reference...
    </div>
  );
}
