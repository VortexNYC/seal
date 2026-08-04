/**
 * Profile Settings Page - Security
 *
 * Account security overview. Password reset runs through the email flow
 * (Better-Auth); two-factor enrollment UI is wired in a follow-up (2FA is
 * opt-in and not yet enabled for Seal).
 * Route: /{slug}/settings/profile/security
 */

import { createFileRoute } from "@tanstack/react-router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your account security.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            To change your password, sign out and use the “Forgot password” link
            on the sign-in page — we’ll email you a secure reset link.
          </p>
          <p>Two-factor authentication will be available here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
