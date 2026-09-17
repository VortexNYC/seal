import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { Building } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import Loader from "@/components/loader";
import { betterAuthClient } from "@/lib/better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";

interface ChooseOrganizationSearch {
  next?: string;
}

export const Route = createFileRoute(
  "/_authenticated/onboarding/choose-organization/"
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>
  ): ChooseOrganizationSearch => {
    const result: ChooseOrganizationSearch = {};
    if (search.next === "developer") {
      result.next = "developer";
    }
    return result;
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const orgDestination = (slug: string) =>
    buildOrganizationPath(
      slug,
      next === "developer" ? "/settings/developer" : "/home"
    );
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
          onCreated={(slug) => {
            if (next === "developer" && slug) {
              void betterAuthClient?.organization
                .setActive({ organizationSlug: slug })
                .then(() => {
                  void navigate({
                    to: orgDestination(slug),
                    replace: true,
                  });
                });
              return;
            }
            void navigate({ to: "/app", replace: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
      <LayerCard className="w-full">
        <LayerCard.Primary className="text-center">
          <Text as="h2" size="lg" variant="heading">
            Choose a workspace
          </Text>
        </LayerCard.Primary>
        <LayerCard.Primary className="space-y-3">
          {sorted.map((org) => (
            <OrganizationOption
              key={org.slug}
              name={org.name}
              slug={org.slug}
              onSelect={() => {
                void navigate({
                  to: orgDestination(org.slug),
                  replace: true,
                });
              }}
            />
          ))}
        </LayerCard.Primary>
      </LayerCard>
      <Button
        onClick={() => {
          setShowCreate(true);
        }}
        type="button"
        variant="ghost"
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
      <div className="bg-kumo-elevated flex size-8 items-center justify-center rounded-md">
        <Building className="size-4" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-kumo-secondary text-xs">{slug}</p>
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
  onCreated: (slug?: string) => void;
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
        onSuccess: (data) => {
          onCreated(
            typeof data === "object" && data !== null && "slug" in data
              ? (data.slug as string)
              : undefined
          );
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
    <LayerCard className="w-full">
      <LayerCard.Primary className="text-center">
        <Text as="h2" size="lg" variant="heading">
          Create workspace
        </Text>
      </LayerCard.Primary>
      <LayerCard.Primary className="space-y-4">
        <Input
          id="org-name"
          label="Name"
          onChange={(event) => {
            setName(event.target.value);
          }}
          value={name}
        />
        <Input
          id="org-slug"
          label="Slug"
          onChange={(event) => {
            setSlug(event.target.value);
          }}
          value={slug}
        />
        {error && (
          <Text as="p" size="sm" variant="error">
            {error}
          </Text>
        )}
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
            variant="primary"
          >
            {create.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </LayerCard.Primary>
    </LayerCard>
  );
}
