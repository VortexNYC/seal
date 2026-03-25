/**
 * General Settings Page
 *
 * Organization general settings
 * Route: /{slug}/settings
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Building2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
  component: GeneralSettings,
  pendingComponent: FormSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.settings.title },
      { name: "description", content: pageSEO.settings.description },
    ],
  }),
});

function GeneralSettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const updateWorkspace = useMutation(api.organizations.mutations.updateWorkspace);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    timezone: "UTC",
    currency: "BRL",
    currencyKind: "normal",
  });

  // Initialize form data when organization loads
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        timezone: organization.timezone || "UTC",
        currency: organization.currency || "BRL",
        currencyKind: organization.currencyKind || "normal",
      });
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateWorkspace({
        name: formData.name.trim(),
        timezone: formData.timezone,
        currency: formData.currency,
        currencyKind: formData.currencyKind,
      });

      toast.success("Workspace settings updated successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update workspace settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper title="General Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {/* Workspace Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Workspace Information</CardTitle>
            </div>
            <CardDescription>Update your workspace name and identification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Workspace"
                required
              />
              <p className="text-muted-foreground text-sm">
                This is the display name for your workspace
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Workspace Slug</Label>
              <Input
                id="slug"
                type="text"
                value={organization.slug}
                disabled
                className="bg-muted"
              />
              <p className="text-muted-foreground text-sm">
                The slug is used in URLs and cannot be changed
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
