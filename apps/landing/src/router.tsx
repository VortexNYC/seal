import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

function NotFound() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground mt-2">Page not found</p>
      <a className="text-primary mt-4 underline" href="/">
        Go home
      </a>
    </div>
  );
}

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFound,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
