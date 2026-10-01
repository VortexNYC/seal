import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, Link, RouterProvider } from "@tanstack/react-router";
import { forwardRef, useMemo } from "react";
import ReactDOM from "react-dom/client";

import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import Loader from "./components/loader";
import { NotFound } from "./components/not-found";
import { ThemeProvider } from "./components/theme-provider";
import { schedulePosthogBoot } from "./lib/posthog-client";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cap: revisiting Documents/Templates/Settings felt like a cold load every time.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ to, ...rest }, ref) => {
    // Cap: Documentation → docs.seal.nyc. Absolute URLs must stay real <a>
    // tags — TanStack Link treats them as in-app paths and blanks the SPA.
    const href = typeof to === "string" ? to : "";
    const isExternal = /^https?:\/\//i.test(href);

    const { pathname, search } = useMemo(() => {
      if (isExternal) {
        return { pathname: "/", search: {} as Record<string, string> };
      }
      const resolved = href ? (href.startsWith("/") ? href : `/${href}`) : "/";
      const url = new URL(resolved, "http://localhost");
      const searchRecord: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        searchRecord[key] = value;
      });
      return { pathname: `${url.pathname}${url.hash}`, search: searchRecord };
    }, [href, isExternal]);

    if (isExternal) {
      return <a ref={ref} href={href} {...rest} />;
    }

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
  defaultPreloadStaleTime: 30_000,
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

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);

  // Analytics stay off the critical path — boot posthog on idle after the
  // first paint instead of blocking ~334KB of JS up front.
  const bootAnalytics = (): void => {
    schedulePosthogBoot();
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(bootAnalytics);
  } else {
    setTimeout(bootAnalytics, 1);
  }
}
