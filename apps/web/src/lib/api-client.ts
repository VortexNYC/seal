import { z } from "zod";

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const teamSummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  pending: z.number().int(),
  byRole: z.object({
    owner: z.number().int(),
    admin: z.number().int(),
    member: z.number().int(),
    viewer: z.number().int(),
  }),
});

export type ApiOrganization = z.infer<typeof organizationSchema>;
export type ApiTeamSummary = z.infer<typeof teamSummarySchema>;

function getBaseUrl(): string {
  const value: unknown = import.meta.env.VITE_API_URL;
  if (typeof value === "string" && value.length > 0) {
    return value.replace(/\/$/, "");
  }
  return "";
}

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data: unknown = await response.json();
  return schema.parse(data);
}

export async function getOrganization(slug: string): Promise<ApiOrganization> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(slug)}`,
    organizationSchema
  );
}

export async function getOrganizationTeam(
  slug: string
): Promise<ApiTeamSummary> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(slug)}/team`,
    teamSummarySchema
  );
}
