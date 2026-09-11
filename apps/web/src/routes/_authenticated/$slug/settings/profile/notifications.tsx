import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { Bell, Clock, Desktop, EnvelopeSimple } from "@phosphor-icons/react";
/**
 * Profile Settings Page - Notifications
 *
 * User notification preferences management
 * Route: /{slug}/settings/profile/notifications
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormSkeleton } from "@/components/skeletons";
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from "@/lib/api-client";
import { parseSelectValue } from "@/lib/select-values";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/notifications"
)({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

type NotificationFrequency = "instant" | "daily" | "weekly";

const NOTIFICATION_FREQUENCIES = [
  "instant",
  "daily",
  "weekly",
] as const satisfies readonly NotificationFrequency[];

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
  const { data: userProfile } = useQuery({
    queryKey: ["api", "users", "me", "notification-preferences"],
    queryFn: getUserNotificationPreferences,
  });
  const updateNotificationPreferences = useMutation({
    mutationFn: updateUserNotificationPreferences,
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>(
    DEFAULT_EMAIL_PREFERENCES
  );
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [desktopEnabled, setDesktopEnabled] = useState(false);
  const [frequency, setFrequency] = useState<NotificationFrequency>("instant");

  useEffect(() => {
    if (userProfile) {
      setEmailPrefs(userProfile.email);
      setInAppEnabled(userProfile.inApp);
      setDesktopEnabled(userProfile.desktop);
      setFrequency(userProfile.frequency);
    }
  }, [userProfile]);

  const handleEmailToggle = async (
    key: keyof EmailPreferences,
    value: boolean
  ) => {
    const newPrefs = { ...emailPrefs, [key]: value };

    if (key === "enabled" && !value) {
      newPrefs.documentEvents = false;
      newPrefs.reminders = false;
      newPrefs.weeklyDigest = false;
    }

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
      await updateNotificationPreferences.mutateAsync(updates);
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
      <LayerCard>
        <LayerCard.Secondary>
          <div className="flex items-center gap-2">
            <EnvelopeSimple className="size-5" />
            <Text as="h2" variant="heading">
              Email Notifications
            </Text>
          </div>
          <Text variant="secondary" size="sm">
            Choose which email notifications you want to receive
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary className="space-y-6">
          <div className="space-y-2">
            <Checkbox
              label="Email Notifications"
              checked={emailPrefs.enabled}
              onCheckedChange={(checked) =>
                void handleEmailToggle("enabled", checked)
              }
              disabled={isUpdating}
            />
            <Text variant="secondary" size="sm">
              Receive notifications via email
            </Text>
          </div>

          {emailPrefs.enabled && (
            <div className="space-y-4 border-l-2 pl-4">
              <div className="space-y-2">
                <Checkbox
                  label="Document Events"
                  checked={emailPrefs.documentEvents}
                  onCheckedChange={(checked) =>
                    void handleEmailToggle("documentEvents", checked)
                  }
                  disabled={isUpdating}
                />
                <Text variant="secondary" size="sm">
                  When documents are sent, signed, or completed
                </Text>
              </div>

              <div className="space-y-2">
                <Checkbox
                  label="Reminders"
                  checked={emailPrefs.reminders}
                  onCheckedChange={(checked) =>
                    void handleEmailToggle("reminders", checked)
                  }
                  disabled={isUpdating}
                />
                <Text variant="secondary" size="sm">
                  Reminder emails for pending signatures
                </Text>
              </div>

              <div className="space-y-2">
                <Checkbox
                  label="Weekly Digest"
                  checked={emailPrefs.weeklyDigest}
                  onCheckedChange={(checked) =>
                    void handleEmailToggle("weeklyDigest", checked)
                  }
                  disabled={isUpdating}
                />
                <Text variant="secondary" size="sm">
                  Weekly summary of your document activity
                </Text>
              </div>
            </div>
          )}
        </LayerCard.Primary>
      </LayerCard>

      <LayerCard>
        <LayerCard.Secondary>
          <div className="flex items-center gap-2">
            <Bell className="size-5" />
            <Text as="h2" variant="heading">
              In-App Notifications
            </Text>
          </div>
          <Text variant="secondary" size="sm">
            Notifications shown within the application
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary className="space-y-2">
          <Checkbox
            label="In-App Notifications"
            checked={inAppEnabled}
            onCheckedChange={(checked) => void handleInAppToggle(checked)}
            disabled={isUpdating}
          />
          <Text variant="secondary" size="sm">
            Show notifications in the app notification center
          </Text>
        </LayerCard.Primary>
      </LayerCard>

      <LayerCard>
        <LayerCard.Secondary>
          <div className="flex items-center gap-2">
            <Desktop className="size-5" />
            <Text as="h2" variant="heading">
              Desktop Notifications
            </Text>
          </div>
          <Text variant="secondary" size="sm">
            Browser push notifications for important updates
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary className="space-y-2">
          <Checkbox
            label="Desktop Notifications"
            checked={desktopEnabled}
            onCheckedChange={(checked) => void handleDesktopToggle(checked)}
            disabled={isUpdating}
          />
          <Text variant="secondary" size="sm">
            Receive push notifications in your browser
          </Text>
        </LayerCard.Primary>
      </LayerCard>

      <LayerCard>
        <LayerCard.Secondary>
          <div className="flex items-center gap-2">
            <Clock className="size-5" />
            <Text as="h2" variant="heading">
              Notification Frequency
            </Text>
          </div>
          <Text variant="secondary" size="sm">
            How often you want to receive non-critical notifications
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="frequency">Frequency</Label>
              <Text variant="secondary" size="sm">
                Choose how often you receive notification digests
              </Text>
            </div>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) => {
                const parsed = parseSelectValue(
                  e.target.value,
                  NOTIFICATION_FREQUENCIES
                );
                if (parsed) {
                  void handleFrequencyChange(parsed);
                }
              }}
              disabled={isUpdating}
              className="h-10 rounded-md border bg-transparent px-3 py-2 text-base md:text-sm"
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily Digest</option>
              <option value="weekly">Weekly Digest</option>
            </select>
          </div>
        </LayerCard.Primary>
      </LayerCard>
    </div>
  );
}
