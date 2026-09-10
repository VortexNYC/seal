import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";

import { betterAuthClient } from "@/lib/better-auth";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute(
  "/_authenticated/onboarding/choose-organization/"
)({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { data: organizations, isPending } = useQuery({
    queryKey: ["auth", "organization", "list"],
    queryFn: async () => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.list();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
  const [showCreate, setShowCreate] = useState(false);

  const sorted = useMemo(() => {
    if (!organizations) return [];
    return organizations.toSorted((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

  if (isPending || organizations === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (showCreate || sorted.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
        <CreateOrganizationCard
          hasOrganizations={sorted.length > 0}
          onCancel={
            sorted.length > 0
              ? () => {
                  setShowCreate(false);
                }
              : undefined
          }
          onCreated={() => {
            void navigate({ to: "/app", replace: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">Choose a workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map((org) => (
            <OrganizationOption
              key={org.slug}
              name={org.name}
              slug={org.slug}
              onSelect={() => {
                void navigate({
                  to: buildOrganizationPath(org.slug, "/home"),
                  replace: true,
                });
              }}
            />
          ))}
        </CardContent>
      </Card>
      <Button
        onClick={() => {
          setShowCreate(true);
        }}
        type="button"
        variant="link"
      >
        Create a new workspace
      </Button>
    </div>
  );
}

function OrganizationOption({
  name,
  slug,
  onSelect,
}: {
  name: string;
  slug: string;
  onSelect: () => void;
}) {
  const select = useMutation({
    mutationFn: async (organizationSlug: string) => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.setActive({
        organizationSlug,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  return (
    <Button
      className="h-auto w-full justify-start gap-3 py-3"
      disabled={select.isPending}
      onClick={() => {
        select.mutate(slug, { onSuccess: onSelect });
      }}
      type="button"
      variant="outline"
    >
      <div className="bg-muted flex size-8 items-center justify-center rounded-md">
        <Building2 className="size-4" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{slug}</p>
      </div>
    </Button>
  );
}

function CreateOrganizationCard({
  hasOrganizations,
  onCancel,
  onCreated,
}: {
  hasOrganizations: boolean;
  onCancel?: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.create({
        name: input.name,
        slug: input.slug,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  const handleCreate = () => {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }
    setError(null);
    create.mutate(
      { name: name.trim(), slug: slug.trim() },
      {
        onSuccess: () => {
          onCreated();
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : "Failed to create workspace"
          );
        },
      }
    );
  };

  const canCreate = name.trim().length > 0 && slug.trim().length > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-center">Create workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            onChange={(event) => {
              setName(event.target.value);
            }}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            onChange={(event) => {
              setSlug(event.target.value);
            }}
            value={slug}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          {hasOrganizations && onCancel && (
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
          )}
          <Button
            disabled={!canCreate || create.isPending}
            onClick={handleCreate}
            type="button"
          >
            {create.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
