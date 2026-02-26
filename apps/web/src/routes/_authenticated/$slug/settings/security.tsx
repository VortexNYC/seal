/**
 * Security Settings Page
 *
 * Organization security policies (owner-only mutations)
 * Route: /{slug}/settings/security
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Save, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/settings/security")({
  component: SecuritySettings,
  pendingComponent: FormSkeleton,
});

const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
];

function SecuritySettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const securitySettings = useQuery(
    api.organizations.queries.getSecuritySettings,
    organization ? { organizationId: organization._id } : "skip",
  );

  const updateSecuritySettings = useMutation(
    api.organizations.mutations.updateSecuritySettings,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    requireMfa: false,
    ipAllowlistText: "",
    sessionTimeoutMinutes: 480,
    allowApiAccess: true,
  });

  useEffect(() => {
    if (securitySettings) {
      setFormData({
        requireMfa: securitySettings.requireMfa,
        ipAllowlistText: securitySettings.ipAllowlist?.join("\n") ?? "",
        sessionTimeoutMinutes: securitySettings.sessionTimeoutMinutes,
        allowApiAccess: securitySettings.allowApiAccess,
      });
    }
  }, [securitySettings]);

  const isOwner = organization?.userRole === "owner";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ipAllowlist = formData.ipAllowlistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      await updateSecuritySettings({
        requireMfa: formData.requireMfa,
        ipAllowlist: ipAllowlist.length > 0 ? ipAllowlist : undefined,
        sessionTimeoutMinutes: formData.sessionTimeoutMinutes,
        allowApiAccess: formData.allowApiAccess,
      });
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update security settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!organization || !securitySettings) {
    return null;
  }

  return (
    <PageWrapper title="Security Settings">
      <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
        {!isOwner && (
          <Card className="border-amber-200 bg-amber-50 md:col-span-2 dark:border-amber-900 dark:bg-amber-950">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Security settings can only be modified by organization owners. Contact your
                organization owner to make changes.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <CardTitle>Access Controls</CardTitle>
            </div>
            <CardDescription>
              Configure authentication and access policies for your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-mfa" className="text-sm font-medium">
                  Require multi-factor authentication
                </Label>
                <p className="text-muted-foreground text-xs">
                  All organization members must have MFA enabled to access the workspace.
                </p>
              </div>
              <Switch
                id="require-mfa"
                checked={formData.requireMfa}
                disabled={!isOwner}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requireMfa: checked })
                }
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor="allow-api" className="text-sm font-medium">
                    Allow API access
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Enable programmatic access via API keys. Disabling revokes all existing
                    API key access.
                  </p>
                </div>
                <Switch
                  id="allow-api"
                  checked={formData.allowApiAccess}
                  disabled={!isOwner}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowApiAccess: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Timeout</CardTitle>
            <CardDescription>
              Automatically sign out inactive users after this period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={String(formData.sessionTimeoutMinutes)}
              disabled={!isOwner}
              onValueChange={(value) =>
                setFormData({ ...formData, sessionTimeoutMinutes: Number(value) })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IP Allowlist</CardTitle>
            <CardDescription>
              Restrict workspace access to specific IP addresses or CIDR ranges. Leave empty
              for no restriction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.ipAllowlistText}
              disabled={!isOwner}
              onChange={(e) =>
                setFormData({ ...formData, ipAllowlistText: e.target.value })
              }
              placeholder={"192.168.1.0/24\n10.0.0.0/8"}
              rows={4}
            />
            <p className="text-muted-foreground mt-2 text-xs">One CIDR range per line</p>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isOwner}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
