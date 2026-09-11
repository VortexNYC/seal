import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

export interface OrganizationView {
  _id: string;
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: Record<string, unknown>;
  status: string;
  userRole: string;
  suiteBrand: Record<string, unknown>;
  suiteSecurity: Record<string, unknown>;
  brandingSettings: Record<string, unknown> | null;
  delegateOwnership: boolean;
  timezone: string;
  currency: string;
  currencyKind: string;
  plan: string;
  createdAt: number;
}

const recordSchema = z.record(z.string(), z.unknown());

function asRecord(value: unknown): Record<string, unknown> {
  const result = recordSchema.safeParse(value);
  return result.success ? result.data : {};
}

function toNumber(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  if (typeof value === "number") return value;
  return 0;
}

async function fetchOrganization(
  slug: string,
  userId: string | undefined
): Promise<OrganizationView | null> {
  const client = getBetterAuthUiClient();
  if (client === null) {
    throw new Error("Auth client is not available.");
  }
  if (client.organization?.getFullOrganization === undefined) {
    throw new Error("Organization API is not available.");
  }

  const fullOrg = await client.organization.getFullOrganization({
    query: { organizationSlug: slug },
  });

  if (fullOrg.error !== null) {
    throw new Error(fullOrg.error.message ?? "Could not load organization.");
  }

  const data = fullOrg.data;
  if (data == null) {
    return null;
  }

  const members = data.members ?? [];
  const currentMember =
    userId === undefined
      ? undefined
      : members.find((member) => member.userId === userId);

  const meta = data.metadata ?? {};
  const status = typeof meta.status === "string" ? meta.status : "active";
  const plan = typeof meta.plan === "string" ? meta.plan : "free";
  const timezone = typeof meta.timezone === "string" ? meta.timezone : "UTC";
  const currency = typeof meta.currency === "string" ? meta.currency : "BRL";
  const currencyKind =
    typeof meta.currencyKind === "string" ? meta.currencyKind : "normal";
  const delegateOwnership = meta.delegateOwnership === true;
  const branding = asRecord(meta.brandingSettings);

  return {
    _id: data.id,
    id: data.id,
    name: data.name,
    slug: data.slug,
    logo:
      typeof data.logo === "string" && data.logo.length > 0 ? data.logo : null,
    metadata: meta,
    status,
    userRole: currentMember?.role ?? "member",
    suiteBrand: asRecord(meta.suiteBrand),
    suiteSecurity: asRecord(meta.suiteSecurity),
    brandingSettings: Object.keys(branding).length > 0 ? branding : null,
    delegateOwnership,
    timezone,
    currency,
    currencyKind,
    plan,
    createdAt: toNumber(data.createdAt),
  };
}

function useOrganizationClient() {
  const client = getBetterAuthUiClient();
  if (client === null) {
    throw new Error("Auth client is not available.");
  }
  const session = client.useSession();
  return { client, userId: session.data?.user?.id };
}

export function useOrganization(slug: string) {
  const { userId } = useOrganizationClient();
  return useQuery({
    queryKey: ["organization", slug],
    queryFn: () => fetchOrganization(slug, userId),
  });
}

export function useSuspenseOrganization(slug: string) {
  const { userId } = useOrganizationClient();
  return useSuspenseQuery({
    queryKey: ["organization", slug],
    queryFn: () => fetchOrganization(slug, userId),
  });
}
