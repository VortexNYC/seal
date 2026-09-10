import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { createVortexPostHogWebInitOptions } from "@vortexnyc/observability";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import ReactDOM from "react-dom/client";

import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import Loader from "./components/loader";
import { NotFound } from "./components/not-found";
import { ThemeProvider } from "./components/theme-provider";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Loader />,
  defaultErrorComponent: DefaultCatchBoundary,
  defaultNotFoundComponent: () => <NotFound />,
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  context: { queryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    );
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

const RAW_POSTHOG_KEY: unknown = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_KEY = typeof RAW_POSTHOG_KEY === "string" ? RAW_POSTHOG_KEY : "";
const posthogInitOptions = createVortexPostHogWebInitOptions({
  apiHost: "/ingest",
  uiHost: "https://us.i.posthog.com",
});

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    defaults: "2026-01-30",
    api_host: posthogInitOptions.apiHost,
    ui_host: posthogInitOptions.uiHost,
    autocapture: posthogInitOptions.autocapture,
    capture_pageview: posthogInitOptions.capturePageview,
    persistence: posthogInitOptions.persistence,
    person_profiles: "identified_only",
    secure_cookie: true,
    enable_heatmaps: true,
    enable_recording_console_log: true,
    capture_performance: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    debug: import.meta.env.MODE === "development",
  });
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <PostHogProvider client={posthog}>
      <RouterProvider router={router} />
    </PostHogProvider>
  );
}
