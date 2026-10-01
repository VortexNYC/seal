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
  create?: boolean;
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
    if (
      search.create === true ||
      search.create === "true" ||
      search.create === "1"
    ) {
      result.create = true;
    }
    return result;
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { next, create } = Route.useSearch();
  const orgDestination = (slug: string) =>
    buildOrganizationPath(
      slug,
      next === "developer" ? "/settings/developer" : "/home"
    );
  const newOrgDestination = (slug: string) =>
    buildOrganizationPath(
      slug,
      next === "developer" ? "/settings/developer" : "/onboarding/compliance"
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
  const [showCreate, setShowCreate] = useState(Boolean(create));

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
    const hasOrgs = sorted.length > 0;
    return (
      <div className="bg-background text-foreground flex min-h-dvh flex-col">
        {hasOrgs ? (
          <header className="border-border flex h-14 shrink-0 items-center border-b px-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCreate(false);
                void navigate({ to: "/app", replace: true });
              }}
            >
              ← Back to app
            </Button>
          </header>
        ) : null}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-4">
          <CreateOrganizationCard
            hasOrganizations={hasOrgs}
            onCancel={
              hasOrgs
                ? () => {
                    setShowCreate(false);
                    if (create) {
                      void navigate({ to: "/app", replace: true });
                      return;
                    }
                    void navigate({
                      to: "/onboarding/choose-organization",
                      search: next ? { next } : {},
                      replace: true,
                    });
                  }
                : undefined
            }
            onCreated={(slug) => {
              if (!slug) {
                void navigate({ to: "/app", replace: true });
                return;
              }
              void betterAuthClient?.organization
                .setActive({ organizationSlug: slug })
                .then(() => {
                  void navigate({
                    to: newOrgDestination(slug),
                    replace: true,
                  });
                })
                .catch(() => {
                  void navigate({ to: "/app", replace: true });
                });
            }}
          />
        </div>
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
        <LayerCard.Primary className="flex flex-col gap-3">
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

function slugifyWorkspaceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function readCreatedSlug(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("slug" in data)) {
    return undefined;
  }
  const slug = Reflect.get(data, "slug");
  return typeof slug === "string" && slug.length > 0 ? slug : undefined;
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
  const [slugTouched, setSlugTouched] = useState(false);
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
    const trimmedName = name.trim();
    const resolvedSlug = slugifyWorkspaceName(slug || trimmedName);
    if (!trimmedName || !resolvedSlug) {
      setError("Workspace name is required");
      return;
    }
    setError(null);
    create.mutate(
      { name: trimmedName, slug: resolvedSlug },
      {
        onSuccess: (data) => {
          onCreated(readCreatedSlug(data) ?? resolvedSlug);
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : "Failed to create workspace"
          );
        },
      }
    );
  };

  const canCreate =
    name.trim().length > 0 && slugifyWorkspaceName(slug || name).length > 0;

  return (
    <LayerCard className="w-full">
      <LayerCard.Primary className="text-center">
        <Text as="h2" size="lg" variant="heading">
          Create your workspace
        </Text>
        <Text as="p" size="sm" variant="secondary">
          One name. Then upload a PDF and send it for signature.
        </Text>
      </LayerCard.Primary>
      <LayerCard.Primary className="flex flex-col gap-4">
        <Input
          id="org-name"
          label="Workspace name"
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!slugTouched) {
              setSlug(slugifyWorkspaceName(nextName));
            }
          }}
          placeholder="Acme"
          value={name}
        />
        <Input
          id="org-slug"
          label="URL slug"
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugifyWorkspaceName(event.target.value));
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
            {create.isPending ? "Creating..." : "Continue"}
          </Button>
        </div>
      </LayerCard.Primary>
    </LayerCard>
  );
}
