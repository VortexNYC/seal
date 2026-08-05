/**
 * Profile Settings Page - General
 *
 * Core VortexUserProfile for account identity; change-email via Core form.
 * Route: /{slug}/settings/profile/ (index)
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  VortexChangeEmailForm,
  VortexUserProfile,
  type VortexUserProfileUser,
  useVortexAuthForgotPassword,
  useVortexAuthUpdateProfile,
} from "@vortexnyc/auth/react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/auth-runtime.better-auth";

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
  }
);

function ProfileSettings() {
  const { user, isLoaded } = useCurrentUser();
  const { updateProfile: updateAuthProfile } =
    useVortexAuthUpdateProfile(authClient);
  const { requestReset, isRequesting } =
    useVortexAuthForgotPassword(authClient);

  const profileUser = useMemo<VortexUserProfileUser | null>(() => {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.username ?? null,
      imageUrl: user.imageUrl ?? null,
    };
  }, [user]);

  return (
    <div className="space-y-6">
      <VortexUserProfile
        isLoading={!isLoaded}
        onChangePassword={() => {
          const email = profileUser?.email?.trim();
          if (!email) {
            toast.error("No email on this account to send a reset link.");
            return;
          }
          if (isRequesting) {
            return;
          }
          void requestReset({
            email,
            redirectTo: `${resolveAppOrigin()}/reset-password`,
          }).then((result) => {
            if (!result.ok) {
              toast.error(
                result.error ?? "Failed to send password reset email"
              );
              return;
            }
            toast.success(
              "Password reset email sent. Check your inbox to set a new password."
            );
          });
        }}
        onManageTwoFactor={() => {
          toast.info("Manage two-factor authentication under Security.");
        }}
        onUpdateProfile={async (input) => {
          const result = await updateAuthProfile({
            name: input.name,
            ...(input.imageUrl != null ? { image: input.imageUrl } : {}),
          });
          if (!result.ok) {
            toast.error(result.error ?? "Failed to update profile");
            return;
          }
          toast.success("Profile updated successfully");
        }}
        user={profileUser}
      />

      <VortexChangeEmailForm
        authClient={authClient}
        currentEmail={profileUser?.email ?? null}
        onRequested={() => {
          toast.success(
            "Confirmation email sent. Click the link from the new address to finish the change."
          );
        }}
        verifyCallbackUrl={`${resolveAppOrigin()}/verify-email`}
      />
    </div>
  );
}
