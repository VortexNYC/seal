import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SealLogo } from "@/components/seal-logo";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

/**
 * Unauthenticated shell — brand is the hero signal; form sits under it.
 * Atmosphere uses theme tokens (no dark: forks). Forms come from better-auth-ui.
 */
function RouteComponent() {
  return (
    <div
      data-auth-shell
      className="bg-background relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,var(--brand-200)_0%,transparent_55%)] opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,var(--muted)_0%,transparent_100%)] opacity-30"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <a
          href="https://seal.nyc"
          className="text-foreground flex flex-row items-center gap-3 no-underline"
        >
          <SealLogo size={40} variant="color" />
          <span className="font-serif text-4xl leading-none tracking-tight">
            Seal
          </span>
        </a>
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
