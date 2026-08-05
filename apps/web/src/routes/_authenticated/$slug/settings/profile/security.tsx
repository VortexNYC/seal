/**
 * Profile Settings Page - Security
 *
 * Core session list + 2FA enrollment via @vortexnyc/auth/react.
 * Route: /{slug}/settings/profile/security
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  VortexEnableTwoFactorForm,
  VortexSessionList,
} from "@vortexnyc/auth/react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/security"
)({
  component: SecuritySettings,
});

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Devices and browsers signed into your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VortexSessionList authClient={authClient} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            Add an authenticator app for stronger account protection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VortexEnableTwoFactorForm
            authClient={authClient}
            issuer="Seal"
            onEnrolled={() => {
              toast.success("Two-factor authentication enabled");
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Manage your account password.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          To change your password, sign out and use the “Forgot password” link
          on the sign-in page — we’ll email you a secure reset link.
        </CardContent>
      </Card>
    </div>
  );
}
