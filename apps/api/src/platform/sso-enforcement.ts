import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { account, organization, ssoProvider } from "../global/schema.js";

const ssoEnforcedMetadataSchema = z
  .object({ ssoEnforced: z.boolean().optional() })
  .passthrough();

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Owners may set `metadata.ssoEnforced` so session members must have signed
 * in through the workspace's SSO provider. API tokens bypass this gate.
 */
export async function isSSOEnforced(
  env: CloudflareBindings,
  organizationId: string
): Promise<boolean> {
  const db = createD1(env.D1);
  const rows = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const parsed = ssoEnforcedMetadataSchema.safeParse(
    parseMetadata(rows[0]?.metadata ?? null)
  );
  return parsed.success && parsed.data.ssoEnforced === true;
}

export async function hasSSOAccountForWorkspace(
  env: CloudflareBindings,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const db = createD1(env.D1);
  const providers = await db
    .select({ providerId: ssoProvider.providerId })
    .from(ssoProvider)
    .where(eq(ssoProvider.organizationId, organizationId));
  if (providers.length === 0) return false;
  const linked = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        inArray(
          account.providerId,
          providers.map((p) => p.providerId)
        )
      )
    )
    .limit(1);
  return linked.length > 0;
}

export function readSSOEnforcedFromMetadata(
  metadata: string | null
): boolean {
  const parsed = ssoEnforcedMetadataSchema.safeParse(parseMetadata(metadata));
  return parsed.success && parsed.data.ssoEnforced === true;
}

export function withSSOEnforcedMetadata(
  metadata: string | null,
  ssoEnforced: boolean
): string {
  const current = parseMetadata(metadata);
  return JSON.stringify({ ...current, ssoEnforced });
}
