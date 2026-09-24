import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

/** Quill mark — same paths as `@seal/tokens` SealMark (currentColor). */
function AuthSealMark(): JSX.Element {
  return (
    <svg
      viewBox="0 0 200 200"
      width={44}
      height={44}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-foreground"
      role="img"
      aria-label="Seal"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Seal</title>
      <path
        d="M50 154 C58 108 88 62 152 40 C146 90 116 136 62 146 Z"
        strokeWidth={9}
      />
      <path d="M42 166 C84 124 120 78 152 40" strokeWidth={6} />
      <path d="M74 130 C84 127 92 122 98 114" strokeWidth={5} />
      <path d="M104 92 C114 89 122 84 128 76" strokeWidth={5} />
    </svg>
  );
}

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
          <AuthSealMark />
          <span className="font-serif text-3xl tracking-tight">Seal</span>
        </a>
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
