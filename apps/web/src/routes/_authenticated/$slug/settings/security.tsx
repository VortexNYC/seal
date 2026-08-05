/**
 * Security Settings Page
 *
 * Organization security policies (owner-only mutations) plus Core access/
 * security audit list (admin/owner). Product document audit stays on
 * settings/audit-log.
 * Route: /{slug}/settings/security
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { VortexSecurityAuditList } from "@vortexnyc/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRightLeft, KeyRound, Save, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@vortexnyc/ui";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/$slug/settings/security")(
  {
    component: SecuritySettings,
    pendingComponent: FormSkeleton,
  }
);

function SecuritySettings() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const securitySettings = useQuery(
    api.organizations.queries.getSecuritySettings,
    organization ? { organizationId: organization._id } : "skip"
  );

  const updateSecuritySettings = useMutation(
    api.organizations.mutations.updateSecuritySettings
  );
  const updateDelegateOwnership = useMutation(
    api.organizations.mutations.updateDelegateOwnership
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDelegateOwnershipUpdating, setIsDelegateOwnershipUpdating] =
    useState(false);
  const [delegateOwnership, setDelegateOwnership] = useState(false);
  const [formData, setFormData] = useState({
    ipAllowlistText: "",
    allowApiAccess: true,
    requireMfa: false,
    sessionTimeoutMinutes: "",
  });
  const [auditRange, setAuditRange] = useState<"7" | "30" | "90">("30");

  const auditFrom = useMemo(
    () => Date.now() - Number(auditRange) * 24 * 60 * 60 * 1000,
    [auditRange]
  );

  const isOwner = organization?.userRole === "owner";
  const isAdmin =
    organization?.userRole === "admin" || organization?.userRole === "owner";

  const securityAuditLogs = useQuery(
    api.organizations.vortex_security_audit.listRecent,
    isAdmin
      ? {
          limit: 100,
          from: auditFrom,
        }
      : "skip"
  );
  useEffect(() => {
    if (securitySettings) {
      setFormData({
        ipAllowlistText: securitySettings.ipAllowlist?.join("\n") ?? "",
        allowApiAccess: securitySettings.allowApiAccess,
        requireMfa: securitySettings.requireMfa ?? false,
        sessionTimeoutMinutes:
          securitySettings.sessionTimeoutMinutes?.toString() ?? "",
      });
    }
  }, [securitySettings]);

  useEffect(() => {
    if (organization) {
      setDelegateOwnership(organization.delegateOwnership ?? false);
    }
  }, [organization]);

  const handleDelegateOwnershipChange = async (checked: boolean) => {
    setIsDelegateOwnershipUpdating(true);
    try {
      setDelegateOwnership(checked);
      await updateDelegateOwnership({ enabled: checked });
      toast.success(
        checked ? "Ownership transfer enabled" : "Ownership transfer disabled"
      );
    } catch (error) {
      setDelegateOwnership(!checked);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update ownership transfer setting"
      );
    } finally {
      setIsDelegateOwnershipUpdating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const ipAllowlist = formData.ipAllowlistText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const timeoutValue = formData.sessionTimeoutMinutes
        ? Number.parseInt(formData.sessionTimeoutMinutes, 10)
        : undefined;

      if (
        timeoutValue !== undefined &&
        (timeoutValue < 15 || timeoutValue > 10080)
      ) {
        toast.error("Session timeout must be between 15 and 10080 minutes");
        setIsSubmitting(false);
        return;
      }

      await updateSecuritySettings({
        ipAllowlist: ipAllowlist.length > 0 ? ipAllowlist : undefined,
        allowApiAccess: formData.allowApiAccess,
        requireMfa: formData.requireMfa,
        sessionTimeoutMinutes: timeoutValue,
      });
      toast.success("Security settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update security settings"
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
          <Card className="border-warning/30 bg-warning-surface md:col-span-2">
            <CardContent className="pt-6">
              <p className="text-warning text-sm">
                Security settings can only be modified by organization owners.
                Contact your organization owner to make changes.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <CardTitle>API Access</CardTitle>
            </div>
            <CardDescription>
              Control programmatic access to your workspace via the REST API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="allow-api" className="text-sm font-medium">
                  Allow API access
                </Label>
                <p className="text-muted-foreground text-xs">
                  Enable programmatic access via API keys. Disabling revokes all
                  existing API key access.
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
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-5" />
              <CardTitle>Session Security</CardTitle>
            </div>
            <CardDescription>
              Enforce multi-factor authentication and session timeout policies
              for all members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="require-mfa" className="text-sm font-medium">
                  Require MFA
                </Label>
                <p className="text-muted-foreground text-xs">
                  Require all organization members to use multi-factor
                  authentication.
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
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="session-timeout" className="text-sm font-medium">
                Session timeout (minutes)
              </Label>
              <Input
                id="session-timeout"
                type="number"
                min={15}
                max={10080}
                placeholder="No timeout"
                disabled={!isOwner}
                value={formData.sessionTimeoutMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sessionTimeoutMinutes: e.target.value,
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Automatically sign out inactive users. Leave empty for no
                timeout. Range: 15–10,080 minutes (7 days).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>IP Allowlist</CardTitle>
            <CardDescription>
              Restrict API access to specific IP addresses or CIDR ranges. Leave
              empty for no restriction.
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
            <p className="text-muted-foreground mt-2 text-xs">
              One CIDR range per line
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="size-5" />
              <CardTitle>Document Ownership Transfer</CardTitle>
            </div>
            <CardDescription>
              Allow document owners to transfer ownership of their documents to
              other organization members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label
                  htmlFor="delegate-ownership"
                  className="text-sm font-medium"
                >
                  Enable ownership transfer
                </Label>
                <p className="text-muted-foreground text-xs">
                  When enabled, document owners and admins can reassign document
                  ownership to any organization member.
                </p>
              </div>
              <Switch
                id="delegate-ownership"
                checked={delegateOwnership}
                disabled={!isAdmin || isDelegateOwnershipUpdating}
                onCheckedChange={handleDelegateOwnershipChange}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end md:col-span-2">
          <Button type="submit" disabled={isSubmitting || !isOwner}>
            <Save className="mr-2 size-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>

      {isAdmin ? (
        <Card className="mt-6">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Access &amp; security events</CardTitle>
              <CardDescription>
                Member, organization, and login events for this workspace. For
                document and signing activity, use the{" "}
                <Link
                  className="underline underline-offset-4"
                  params={{ slug }}
                  to="/$slug/settings/audit-log"
                >
                  Audit log
                </Link>
                .
              </CardDescription>
            </div>
            <div className="space-y-1">
              <Label
                className="text-muted-foreground text-xs"
                htmlFor="audit-window"
              >
                Window
              </Label>
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                id="audit-window"
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "7" || value === "30" || value === "90") {
                    setAuditRange(value);
                  }
                }}
                value={auditRange}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <VortexSecurityAuditList
              copy={{
                emptyMessage: "No matching access or security events.",
              }}
              logs={securityAuditLogs}
            />
          </CardContent>
        </Card>
      ) : null}
    </PageWrapper>
  );
}
