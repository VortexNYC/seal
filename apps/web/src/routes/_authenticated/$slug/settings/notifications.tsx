/**
 * Notification Settings Page
 *
 * Organization notification preferences (admin-only mutations)
 * Route: /{slug}/settings/notifications
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Bell, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/notifications")({
  component: NotificationSettings,
  pendingComponent: FormSkeleton,
});

function NotificationSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const notificationSettings = useQuery(
    api.organizations.queries.getNotificationSettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateNotificationSettings = useMutation(
    api.organizations.mutations.updateNotificationSettings,
  );

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
      reminderSchedule: [...prev.reminderSchedule, day].sort((a, b) => a - b),
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
      await updateNotificationSettings({
        reminderSchedule: formData.reminderSchedule,
        expirationAlertDays: formData.expirationAlertDays,
        sendCompletionEmail: formData.sendCompletionEmail,
        sendViewedNotification: formData.sendViewedNotification,
      });
      toast.success("Notification settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update notification settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !notificationSettings) {
    return null;
  }

  return (
    <PageWrapper title="Notification Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="size-5" />
              <CardTitle>Reminder Schedule</CardTitle>
            </div>
            <CardDescription>
              Send automatic reminders to recipients who haven't signed. Specify the number of days
              after the document is sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {formData.reminderSchedule.map((day) => (
                <Badge key={day} variant="secondary" className="gap-1 px-3 py-1.5">
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
                <p className="text-muted-foreground text-sm">No reminders configured</p>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                className="w-32"
              />
              <Button type="button" variant="outline" size="sm" onClick={addReminderDay}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiration Alert</CardTitle>
            <CardDescription>
              Notify the sender this many days before a document expires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
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
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">days before expiry</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Control which automatic emails are sent for document events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="completion-email" className="text-sm font-medium">
                  Send completion email
                </Label>
                <p className="text-muted-foreground text-xs">
                  Notify the sender when all recipients have signed.
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
            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="viewed-notification" className="text-sm font-medium">
                    Send viewed notification
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Notify the sender when a recipient views the document.
                  </p>
                </div>
                <Switch
                  id="viewed-notification"
                  checked={formData.sendViewedNotification}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sendViewedNotification: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
