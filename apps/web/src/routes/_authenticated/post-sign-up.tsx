import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
  authRoutePaths,
  captureAuthEvent,
  clearPendingPostSignUpSync,
  consumePendingAuthFlow,
  runtime,
} from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_authenticated/post-sign-up")({
  component: PostSignUpPage,
});

const POST_SIGN_UP_SYNC_TIMEOUT_MS = 15_000;

function PostSignUpPage() {
  const navigate = useNavigate();

  return (
    <runtime.AuthPostSignUpRoutePage
      captureAuthEvent={captureAuthEvent}
      chooseOrganizationPath={authRoutePaths.chooseOrganizationPath}
      clearPendingPostSignUpSync={clearPendingPostSignUpSync}
      consumePendingAuthFlow={consumePendingAuthFlow}
      description="We're finishing your Seal workspace access."
      ensureActiveOrganization={api.check_membership.ensureActiveOrganization}
      eyebrow="Seal access"
      getAvailableOrganizations={api.check_membership.getAvailableOrganizations}
      getDefaultOrganization={api.check_membership.getDefaultOrganization}
      navigate={navigate}
      postSignInPath={authRoutePaths.postSignInPath}
      redeemInvitation={api.invitations.redeemInvitation}
      timeoutMs={POST_SIGN_UP_SYNC_TIMEOUT_MS}
      title="Finalizing your workspace"
    />
  );
}
