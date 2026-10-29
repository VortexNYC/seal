import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthShell } from "@vortex-api/better-auth-ui";

import { SealLogo } from "@/components/seal-logo";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <AuthShell
      logo={
        <a
          href="https://seal.nyc"
          className="text-kumo-default flex flex-row items-center gap-3 no-underline"
        >
          <SealLogo size={40} variant="color" />
          <span className="font-serif text-4xl leading-none tracking-tight">
            Seal
          </span>
        </a>
      }
      atmosphere={
        <>
          <div
            aria-hidden
            className="bg-hero-glow pointer-events-none absolute inset-0 opacity-70"
          />
          <div
            aria-hidden
            className="bg-fade-muted pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30"
          />
        </>
      }
    >
      <Outlet />
    </AuthShell>
  );
}
