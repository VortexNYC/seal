/**
 * Notification Settings Page
 *
 * Organization notification preferences (admin-only mutations)
 * Route: /{slug}/settings/notifications
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Switch } from "@cloudflare/kumo/components/switch";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { UserNotificationPreferences } from "@/components/settings/user-notification-preferences";
import { SettingsBody } from "@/components/settings-body";
import { SettingsSection } from "@/components/settings-section";
import { FormSkeleton } from "@/components/skeletons";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/notifications"
)({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

function NotificationSettings() {
  const { slug } = Route.useParams();

  const {
    data: notificationSettings,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["notifications", slug],
    queryFn: () => getNotificationSettings(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newReminderDay, setNewReminderDay] = useState("");
  const [formData, setFormData] = useState({
    reminderSchedule: [3, 7, 14] as number[],
    expirationAlertDays: 3,
    sendCompletionEmail: true,
    sendViewedNotification: true,
  });

  useEffect(() => {
    if (notificationSettings) {
      setFormData({
        reminderSchedule: [...notificationSettings.reminderSchedule],
        expirationAlertDays: notificationSettings.expirationAlertDays,
        sendCompletionEmail: notificationSettings.sendCompletionEmail,
        sendViewedNotification: notificationSettings.sendViewedNotification,
      });
    }
  }, [notificationSettings]);

  if (isPending) {
    return (
      <PageWrapper title="Notifications">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  if (isError) {
    return (
      <PageWrapper title="Notifications">
        <SettingsBody wide>
          <SettingsSection
            title="Workspace notifications"
            description="Workspace notification settings need admin access."
          >
            <p className="text-muted-foreground m-0 text-sm">
              {error instanceof Error
                ? error.message
                : "Your personal preferences are below."}
            </p>
          </SettingsSection>
          <YourPreferencesBlock />
        </SettingsBody>
      </PageWrapper>
    );
  }

  const addReminderDay = () => {
    const day = Number.parseInt(newReminderDay, 10);
    if (Number.isNaN(day) || day < 1) {
      toast.error("Enter a positive number");
      return;
    }
    if (formData.reminderSchedule.includes(day)) {
      toast.error(`Day ${day} is already in the schedule`);
      return;
    }
    if (formData.reminderSchedule.length >= 10) {
      toast.error("Maximum 10 reminder days");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      reminderSchedule: [...prev.reminderSchedule, day].toSorted(
        (a, b) => a - b
      ),
    }));
    setNewReminderDay("");
  };

  const removeReminderDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      reminderSchedule: prev.reminderSchedule.filter((d) => d !== day),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateNotificationSettings(slug, {
        reminderSchedule: formData.reminderSchedule,
        expirationAlertDays: formData.expirationAlertDays,
        sendCompletionEmail: formData.sendCompletionEmail,
        sendViewedNotification: formData.sendViewedNotification,
      });
      toast.success("Notification settings updated");
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "Failed to update notification settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!notificationSettings) {
    return (
      <PageWrapper title="Notification Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Notification Settings">
      <SettingsBody wide>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <SettingsSection
            title="Reminder schedule"
            description="Days after send to nudge recipients who haven’t signed."
            icon={<Bell className="size-4" />}
          >
            <div className="flex flex-wrap gap-2">
              {formData.reminderSchedule.map((day) => (
                <span
                  key={day}
                  className="border-border bg-muted/50 text-foreground inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm tabular-nums"
                >
                  Day {day}
                  <button
                    type="button"
                    onClick={() => removeReminderDay(day)}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    aria-label={`Remove day ${day}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              {formData.reminderSchedule.length === 0 ? (
                <p className="text-muted-foreground m-0 text-sm">
                  No reminders configured
                </p>
              ) : null}
            </div>
            <div className="flex items-end gap-2">
              <div className="w-28">
                <Input
                  type="number"
                  min={1}
                  aria-label="Add reminder day"
                  label="Day"
                  placeholder="e.g. 3"
                  value={newReminderDay}
                  onChange={(e) => setNewReminderDay(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addReminderDay();
                    }
                  }}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addReminderDay}>
                Add
              </Button>
            </div>
          </SettingsSection>

          <div className="grid gap-5 md:grid-cols-2">
            <SettingsSection
              title="Expiration alert"
              description="Warn the sender this many days before a document expires."
            >
              <div className="flex max-w-xs items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    id="expiration-alert-days"
                    aria-label="Days before expiry"
                    label="Days before expiry"
                    type="number"
                    min={1}
                    max={30}
                    value={formData.expirationAlertDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expirationAlertDays: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Email notifications"
              description="Automatic emails for document events."
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="completion-email"
                      className="text-sm font-medium"
                    >
                      Completion email
                    </Label>
                    <p className="text-muted-foreground m-0 text-xs">
                      When all recipients have signed
                    </p>
                  </div>
                  <Switch
                    id="completion-email"
                    checked={formData.sendCompletionEmail}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, sendCompletionEmail: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <Label
                      htmlFor="viewed-notification"
                      className="text-sm font-medium"
                    >
                      Viewed notification
                    </Label>
                    <p className="text-muted-foreground m-0 text-xs">
                      When a recipient opens the document
                    </p>
                  </div>
                  <Switch
                    id="viewed-notification"
                    checked={formData.sendViewedNotification}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        sendViewedNotification: checked,
                      })
                    }
                  />
                </div>
              </div>
            </SettingsSection>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} variant="primary">
              <Save className="mr-2 size-4" />
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>

        <YourPreferencesBlock />
      </SettingsBody>
    </PageWrapper>
  );
}

function YourPreferencesBlock(): React.JSX.Element {
  return (
    <div id="your-preferences" className="flex flex-col gap-3">
      <h2 className="text-foreground m-0 text-base font-semibold tracking-tight">
        Your preferences
      </h2>
      <p className="text-muted-foreground m-0 text-sm">
        Email, in-app, and desktop choices for your account — not the workspace.
      </p>
      <UserNotificationPreferences />
    </div>
  );
}
