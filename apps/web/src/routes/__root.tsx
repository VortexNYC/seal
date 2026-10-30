import { Toasty } from "@cloudflare/kumo/components/toast";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";

import { ErrorBoundary } from "@/components/error-boundary";
import { NotFoundPage } from "@/components/not-found-page";
import { RouteErrorComponent } from "@/components/route-error-component";
import { toastManager } from "@/lib/toast";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        title: "Seal",
      },
    ],
  }),

  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorComponent,
});

const LazyRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/router-devtools").then((m) => ({
        default: m.RouterDevtools,
      }))
    )
  : null;

function RootComponent() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import("react-grab");
    }
  }, []);

  return (
    <RootDocument>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <Toasty toastManager={toastManager}>
      <HeadContent />
      <div className="h-svh">{children}</div>
      {LazyRouterDevtools ? (
        <Suspense fallback={null}>
          <LazyRouterDevtools />
        </Suspense>
      ) : null}
    </Toasty>
  );
}
