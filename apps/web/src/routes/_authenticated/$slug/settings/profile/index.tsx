import { createFileRoute } from "@tanstack/react-router";
/**
 * Profile Settings Page - General
 *
 * User profile, email, and account management via @vortex-api/better-auth-ui.
 * Route: /{slug}/settings/profile/ (index)
 */
import {
  AuthProvider,
  ChangeEmailForm,
  ConnectedAccounts,
  DeleteAccountForm,
  UserProfileForm,
} from "@vortex-api/better-auth-ui";

import { FormSkeleton } from "@/components/skeletons";
import { SettingsBody } from "@/components/settings-body";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { toast } from "@/lib/toast";

function resolveAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (typeof configured === "string" && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://app.seal.nyc";
}

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/")(
  {
    component: ProfileSettings,
    pendingComponent: FormSkeleton,
  }
);

function ProfileSettings() {
  const client = getBetterAuthUiClient();

  if (client === null) {
    return <FormSkeleton />;
  }

  const verifyCallbackUrl = `${resolveAppOrigin()}/verify-email`;

  return (
    <AuthProvider client={client}>
      <SettingsBody className="items-stretch">
        <div className="flex w-full flex-col gap-5">
          <UserProfileForm
            onSuccess={() => {
              toast.success("Profile updated");
            }}
          />
          <ChangeEmailForm
            callbackURL={verifyCallbackUrl}
            onSuccess={() => {
              toast.success(
                "Confirmation email sent. Click the link from the new address to finish the change."
              );
            }}
          />
          <ConnectedAccounts
            onUnlinked={() => {
              toast.success("Account disconnected");
            }}
          />
          <DeleteAccountForm
            onSuccess={() => {
              window.location.assign("/");
            }}
          />
        </div>
      </SettingsBody>
    </AuthProvider>
  );
}
