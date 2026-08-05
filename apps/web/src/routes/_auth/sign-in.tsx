import { createFileRoute, Link } from "@tanstack/react-router";

import {
  authRoutePaths,
  captureAuthEvent,
  markPendingAuthFlow,
  runtime,
} from "@/lib/auth-runtime.better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-in")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signIn, "/sign-in"),
});

function RouteComponent() {
  return (
    <div className="space-y-4">
      <runtime.AuthSignInRoutePage
        captureAuthEvent={captureAuthEvent}
        markPendingAuthFlow={markPendingAuthFlow}
        postSignInPath="/app"
        signUpPath={authRoutePaths.signUpPath}
      />
      <p className="text-muted-foreground text-center text-sm">
        <Link className="underline underline-offset-4" to="/forgot-password">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
