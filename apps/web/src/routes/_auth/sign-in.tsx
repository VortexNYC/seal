import { createFileRoute } from "@tanstack/react-router";

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
    <runtime.AuthSignInRoutePage
      captureAuthEvent={captureAuthEvent}
      forgotPasswordHref="/forgot-password"
      markPendingAuthFlow={markPendingAuthFlow}
      postSignInPath="/app"
      signUpPath={authRoutePaths.signUpPath}
    />
  );
}
