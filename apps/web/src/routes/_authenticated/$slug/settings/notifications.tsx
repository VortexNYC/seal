/**
 * Notification Settings Page
 *
 * Organization notification preferences (admin-only mutations)
 * Route: /{slug}/settings/notifications
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Switch } from "@cloudflare/kumo/components/switch";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/lib/api-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/notifications"
)({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

function NotificationSettings() {
  const { slug } = Route.useParams();

  const { data: notificationSettings } = useQuery({
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
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update notification settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!notificationSettings) {
    return null;
  }

  return (
    <PageWrapper title="Notification Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <LayerCard className="md:col-span-2">
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <Bell className="size-5" />
              <Text as="h2" variant="heading">
                Reminder Schedule
              </Text>
            </div>
            <Text variant="secondary">
              Send automatic reminders to recipients who haven't signed. Specify
              the number of days after the document is sent.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {formData.reminderSchedule.map((day) => (
                <Badge key={day} variant="secondary">
                  Day {day}
                  <button
                    type="button"
                    onClick={() => removeReminderDay(day)}
                    className="hover:text-destructive ml-1"
                    aria-label={`Remove day ${day}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {formData.reminderSchedule.length === 0 && (
                <Text variant="secondary" as="p">
                  No reminders configured
                </Text>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-32">
                <Input
                  type="number"
                  min={1}
                  placeholder="Add day..."
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
              <Button type="button" onClick={addReminderDay}>
                Add
              </Button>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Expiration Alert
            </Text>
            <Text variant="secondary">
              Notify the sender this many days before a document expires.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="flex items-center gap-2">
              <Label htmlFor="expiration-alert-days" className="sr-only">
                Days before expiry
              </Label>
              <div className="w-24">
                <Input
                  id="expiration-alert-days"
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
              <Text variant="secondary" as="span">
                days before expiry
              </Text>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Email Notifications
            </Text>
            <Text variant="secondary">
              Control which automatic emails are sent for document events.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label
                  htmlFor="completion-email"
                  className="text-sm font-medium"
                >
                  Send completion email
                </Label>
                <Text variant="secondary" as="p">
                  Notify the sender when all recipients have signed.
                </Text>
              </div>
              <Switch
                id="completion-email"
                checked={formData.sendCompletionEmail}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, sendCompletionEmail: checked })
                }
              />
            </div>
            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="viewed-notification"
                    className="text-sm font-medium"
                  >
                    Send viewed notification
                  </Label>
                  <Text variant="secondary" as="p">
                    Notify the sender when a recipient views the document.
                  </Text>
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
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
