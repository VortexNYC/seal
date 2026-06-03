import { createFileRoute } from "@tanstack/react-router";

import {
  authRoutePaths,
  captureAuthEvent,
  markPendingAuthFlow,
  markPendingPostSignUpSync,
  runtime,
} from "@/lib/auth-runtime.better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-up")({
  component: RouteComponent,
  head: () => createPageMeta(pageSEO.signUp, "/sign-up"),
});

function RouteComponent() {
  return (
    <runtime.AuthSignUpRoutePage
      signInPath={authRoutePaths.signInPath}
      postSignUpPath="/app"
      markPendingAuthFlow={markPendingAuthFlow}
      markPendingPostSignUpSync={markPendingPostSignUpSync}
      captureAuthEvent={captureAuthEvent}
    />
  );
}
