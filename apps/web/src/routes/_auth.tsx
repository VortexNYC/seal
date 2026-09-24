import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SealLogo } from "@/components/seal-logo";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

/**
 * Unauthenticated shell — Seal mark + serif wordmark above every auth form.
 * Keeps stock better-auth-ui forms but stops the page reading as a bare Kumo demo.
 */
function RouteComponent() {
  return (
    <div
      data-auth-shell
      className="bg-background relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,var(--brand-200)_0%,transparent_55%)] opacity-70 dark:bg-[radial-gradient(ellipse_at_50%_0%,var(--brand-800)_0%,transparent_55%)] dark:opacity-40"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-8">
        <a
          href="https://seal.nyc"
          className="text-foreground flex flex-col items-center gap-3 no-underline"
        >
          <SealLogo size={44} variant="color" />
          <span className="font-serif text-3xl tracking-tight">Seal</span>
        </a>
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
