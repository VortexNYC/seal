import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, Link, RouterProvider } from "@tanstack/react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { forwardRef, useMemo } from "react";
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

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ to, ...rest }, ref) => {
    const { pathname, search } = useMemo(() => {
      const resolved = to ? (to.startsWith("/") ? to : `/${to}`) : "/";
      const url = new URL(resolved, "http://localhost");
      const searchRecord: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        searchRecord[key] = value;
      });
      return { pathname: `${url.pathname}${url.hash}`, search: searchRecord };
    }, [to]);

    return <Link ref={ref} to={pathname} search={search} {...rest} />;
  }
);
AppLink.displayName = "AppLink";

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
          <LinkProvider component={AppLink}>{children}</LinkProvider>
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
const posthogInitOptions = {
  apiHost: "/ingest",
  uiHost: "https://us.i.posthog.com",
  autocapture: false,
  capturePageview: false,
  persistence: "localStorage+cookie" as const,
};

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
    enable_recording_console_log: false,
    capture_performance: false,
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
