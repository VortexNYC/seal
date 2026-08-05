/**
 * Profile Settings Page - Notifications
 *
 * User notification preferences management
 * Route: /{slug}/settings/profile/notifications
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Bell, Clock, Mail, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
} from "@vortexnyc/ui";

import { FormSkeleton } from "@/components/skeletons";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/notifications"
)({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

type NotificationFrequency = "instant" | "daily" | "weekly";

interface EmailPreferences {
  enabled: boolean;
  documentEvents: boolean;
  reminders: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  enabled: true,
  documentEvents: true,
  reminders: true,
  weeklyDigest: false,
};

function NotificationSettings() {
  const userProfile = useQuery(api.user_profiles.queries.getCurrentUserProfile);
  const updateNotificationPreferences = useMutation(
    api.user_profiles.mutations.updateNotificationPreferences
  );

  const [isUpdating, setIsUpdating] = useState(false);

  // Email preferences
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>(
    DEFAULT_EMAIL_PREFERENCES
  );

  // Other notification settings
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [frequency, setFrequency] = useState<NotificationFrequency>("instant");

  // Initialize from profile
  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      const prefs = userProfile.notificationPreferences;

      if (prefs.email) {
        setEmailPrefs(prefs.email);
      }

      if (prefs.inApp !== undefined) {
        setInAppEnabled(prefs.inApp);
      }

      if (prefs.desktop !== undefined) {
        setDesktopEnabled(prefs.desktop);
      }

      if (prefs.frequency) {
        setFrequency(prefs.frequency);
      }
    }
  }, [userProfile?.notificationPreferences]);

  const handleEmailToggle = async (
    key: keyof EmailPreferences,
    value: boolean
  ) => {
    const newPrefs = { ...emailPrefs, [key]: value };

    // If disabling main toggle, disable all sub-options
    if (key === "enabled" && !value) {
      newPrefs.documentEvents = false;
      newPrefs.reminders = false;
      newPrefs.weeklyDigest = false;
    }

    // If enabling a sub-option, ensure main toggle is on
    if (key !== "enabled" && value) {
      newPrefs.enabled = true;
    }

    setEmailPrefs(newPrefs);
    await savePreferences({ email: newPrefs });
  };

  const handleInAppToggle = async (value: boolean) => {
    setInAppEnabled(value);
    await savePreferences({ inApp: value });
  };

  const handleDesktopToggle = async (value: boolean) => {
    if (value) {
      // Request browser notification permission
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error(
            "Please enable notifications in your browser settings to receive desktop notifications"
          );
          return;
        }
      } else {
        toast.error("Desktop notifications are not supported in this browser");
        return;
      }
    }

    setDesktopEnabled(value);
    await savePreferences({ desktop: value });
  };

  const handleFrequencyChange = async (value: NotificationFrequency) => {
    setFrequency(value);
    await savePreferences({ frequency: value });
  };

  const savePreferences = async (updates: {
    email?: EmailPreferences;
    inApp?: boolean;
    desktop?: boolean;
    frequency?: NotificationFrequency;
  }) => {
    setIsUpdating(true);
    try {
      await updateNotificationPreferences(updates);
      toast.success("Notification preferences updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update preferences"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled">Email Notifications</Label>
              <p className="text-muted-foreground text-sm">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={emailPrefs.enabled}
              onCheckedChange={(checked) =>
                handleEmailToggle("enabled", checked)
              }
              disabled={isUpdating}
            />
          </div>

          {emailPrefs.enabled && (
            <>
              <Separator />
              <div className="space-y-4 pl-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="document-events">Document Events</Label>
                    <p className="text-muted-foreground text-sm">
                      When documents are sent, signed, or completed
                    </p>
                  </div>
                  <Switch
                    id="document-events"
                    checked={emailPrefs.documentEvents}
                    onCheckedChange={(checked) =>
                      handleEmailToggle("documentEvents", checked)
                    }
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminders">Reminders</Label>
                    <p className="text-muted-foreground text-sm">
                      Reminder emails for pending signatures
                    </p>
                  </div>
                  <Switch
                    id="reminders"
                    checked={emailPrefs.reminders}
                    onCheckedChange={(checked) =>
                      handleEmailToggle("reminders", checked)
                    }
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-digest">Weekly Digest</Label>
                    <p className="text-muted-foreground text-sm">
                      Weekly summary of your document activity
                    </p>
                  </div>
                  <Switch
                    id="weekly-digest"
                    checked={emailPrefs.weeklyDigest}
                    onCheckedChange={(checked) =>
                      handleEmailToggle("weeklyDigest", checked)
                    }
                    disabled={isUpdating}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>In-App Notifications</CardTitle>
          </div>
          <CardDescription>
            Notifications shown within the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="in-app">In-App Notifications</Label>
              <p className="text-muted-foreground text-sm">
                Show notifications in the app notification center
              </p>
            </div>
            <Switch
              id="in-app"
              checked={inAppEnabled}
              onCheckedChange={handleInAppToggle}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>

      {/* Desktop Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <CardTitle>Desktop Notifications</CardTitle>
          </div>
          <CardDescription>
            Browser push notifications for important updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="desktop">Desktop Notifications</Label>
              <p className="text-muted-foreground text-sm">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              id="desktop"
              checked={desktopEnabled}
              onCheckedChange={handleDesktopToggle}
              disabled={isUpdating}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Frequency */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Notification Frequency</CardTitle>
          </div>
          <CardDescription>
            How often you want to receive non-critical notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="frequency">Frequency</Label>
              <p className="text-muted-foreground text-sm">
                Choose how often you receive notification digests
              </p>
            </div>
            <Select
              value={frequency}
              onValueChange={(value) =>
                handleFrequencyChange(value as NotificationFrequency)
              }
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
