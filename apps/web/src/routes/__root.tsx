import { Toasty } from "@cloudflare/kumo/components/toast";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

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
      <TanStackRouterDevtools position="bottom-right" />
    </Toasty>
  );
}
