// VAL-REAL-1776573534487
import { ConvexQueryClient } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import ReactDOM from "react-dom/client";
// Pipeline edit proof — T2-SEAL-1776571434447

import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import Loader from "./components/loader";
import { NotFound } from "./components/not-found";
import { ThemeProvider } from "./components/theme-provider";
import { AuthRuntimeProvider } from "./lib/auth-runtime.better-auth";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const shouldInitSentry = Boolean(SENTRY_DSN) && import.meta.env.PROD;

if (!CONVEX_URL) {
  throw new Error("missing VITE_CONVEX_URL envar");
}

const convex = new ConvexReactClient(CONVEX_URL);
const convexQueryClient = new ConvexQueryClient(convex);

// Expose Convex client & API on `window` in dev/test/staging/preview so E2E
// tests (and agent-browser sessions) can call mutations/queries directly.
const isPreviewDeployment =
  typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
const isStagingDomain =
  typeof window !== "undefined" && window.location.hostname.includes("staging");
const shouldExposeConvexApi =
  import.meta.env.DEV ||
  import.meta.env.MODE === "test" ||
  isStagingDomain ||
  (import.meta.env.VITE_EXPOSE_CONVEX_API === "true" && isPreviewDeployment);

if (shouldExposeConvexApi) {
  (window as Window & { __convexClient?: typeof convex }).__convexClient = convex;
  (window as Window & { __convexApi?: typeof api }).__convexApi = api;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
});
convexQueryClient.connect(queryClient);

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: () => <Loader />,
  defaultErrorComponent: DefaultCatchBoundary,
  defaultNotFoundComponent: () => <NotFound />,
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  context: { queryClient, convexClient: convex, convexQueryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <AuthRuntimeProvider convex={convex}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </AuthRuntimeProvider>
      </ThemeProvider>
    );
  },
});

// Sentry — init after router is created so we can pass it to the tracing integration
if (shouldInitSentry) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "production",
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    sendDefaultPii: true,
    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    tracesSampleRate: 0.2,
    tracePropagationTargets: [/^\//, /convex\.cloud/],
    beforeSend(event) {
      // Strip document content and signature data from breadcrumbs
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.data) {
            delete crumb.data.pdfContent;
            delete crumb.data.signatureData;
            delete crumb.data.documentContent;
          }
        }
      }
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "Failed to fetch",
      "Load failed",
      "NetworkError",
    ],
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string;

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    defaults: "2026-01-30",
    api_host: "/ingest",
    ui_host: "https://us.i.posthog.com",
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
  const root = ReactDOM.createRoot(rootElement, {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  });
  root.render(
    <PostHogProvider client={posthog}>
      <RouterProvider router={router} />
    </PostHogProvider>,
  );
}
