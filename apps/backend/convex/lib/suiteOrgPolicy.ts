/**
 * Suite org brand + security policy helpers (SEA-603 / SEA-604).
 *
 * Source of truth: vortex-auth organization `metadataJson.brand` /
 * `metadataJson.security` (Core VOR-182 / VOR-183). Seal mirrors brand
 * colors/email into local `brandingSettings` so signing/emails keep working
 * until every reader is cut over.
 *
 * Brand parse helpers live in `@vortexnyc/auth/react`; this module keeps a
 * Convex-safe copy so the backend never imports the React entry.
 */

import {
  evaluateOrganizationSecurityAccess,
  parseOrganizationSecurityPolicy,
} from "@vortexnyc/auth/convex";
import type { GenericId } from "convex/values";
import { ConvexError } from "convex/values";

import { components } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type OrgCtx = Pick<QueryCtx | MutationCtx, "runQuery">;
type OrgWriteCtx = Pick<MutationCtx, "db" | "runQuery" | "runMutation">;

export type SuiteOrgBrand = {
  primaryColor?: string;
  accentColor?: string;
  website?: string;
  emailFromName?: string;
  emailReplyTo?: string;
};

export type SuiteOrgBrandUpdate = {
  [K in keyof SuiteOrgBrand]?: string | null;
};

export type SuiteOrgSecurity = {
  requireMfa?: boolean;
  sessionTimeoutMinutes?: number;
};

export type SuiteOrgSecurityUpdate = {
  requireMfa?: boolean | null;
  sessionTimeoutMinutes?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBrandFromMetadataJson(
  metadataJson: string | null | undefined
): SuiteOrgBrand | undefined {
  if (!metadataJson || metadataJson.trim() === "") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!isRecord(parsed) || !isRecord(parsed.brand)) {
      return undefined;
    }
    const brand: SuiteOrgBrand = {
      ...(optionalString(parsed.brand.primaryColor)
        ? { primaryColor: optionalString(parsed.brand.primaryColor) }
        : {}),
      ...(optionalString(parsed.brand.accentColor)
        ? { accentColor: optionalString(parsed.brand.accentColor) }
        : {}),
      ...(optionalString(parsed.brand.website)
        ? { website: optionalString(parsed.brand.website) }
        : {}),
      ...(optionalString(parsed.brand.emailFromName)
        ? { emailFromName: optionalString(parsed.brand.emailFromName) }
        : {}),
      ...(optionalString(parsed.brand.emailReplyTo)
        ? { emailReplyTo: optionalString(parsed.brand.emailReplyTo) }
        : {}),
    };
    return Object.keys(brand).length > 0 ? brand : undefined;
  } catch {
    return undefined;
  }
}

function parseSecurityFromMetadataJson(
  metadataJson: string | null | undefined
): SuiteOrgSecurity | undefined {
  const policy = parseOrganizationSecurityPolicy(metadataJson);
  if (!policy.requireMfa && policy.sessionTimeoutMinutes === undefined) {
    return undefined;
  }
  return {
    ...(policy.requireMfa ? { requireMfa: true } : { requireMfa: false }),
    ...(policy.sessionTimeoutMinutes !== undefined
      ? { sessionTimeoutMinutes: policy.sessionTimeoutMinutes }
      : {}),
  };
}

export async function loadVortexAuthOrganizationMetadataJson(
  ctx: OrgCtx,
  vortexAuthOrganizationId: string | undefined
): Promise<string | undefined> {
  if (!vortexAuthOrganizationId) {
    return undefined;
  }
  const org = await ctx.runQuery(
    components.vortexAuth.organizations.getOrganization,
    {
      organizationId: vortexAuthOrganizationId as GenericId<"organizations">,
    }
  );
  return org?.metadataJson;
}

export async function loadSuiteOrgBrandAndSecurity(
  ctx: OrgCtx,
  organization: Pick<Doc<"organizations">, "vortexAuthOrganizationId">
): Promise<{
  brand?: SuiteOrgBrand;
  security?: SuiteOrgSecurity;
  metadataJson?: string;
}> {
  const metadataJson = await loadVortexAuthOrganizationMetadataJson(
    ctx,
    organization.vortexAuthOrganizationId
  );
  return {
    metadataJson,
    brand: parseBrandFromMetadataJson(metadataJson),
    security: parseSecurityFromMetadataJson(metadataJson),
  };
}

export async function syncSuiteOrgDetailsToVortexAuth(
  ctx: OrgWriteCtx,
  organization: Doc<"organizations">,
  input: {
    name?: string;
    slug?: string;
    imageUrl?: string | null;
    brand?: SuiteOrgBrandUpdate;
    security?: SuiteOrgSecurityUpdate;
  }
): Promise<void> {
  if (!organization.vortexAuthOrganizationId) {
    throw new ConvexError("Organization is not anchored to Vortex Auth");
  }

  const organizationId =
    organization.vortexAuthOrganizationId as GenericId<"organizations">;

  if (
    input.name !== undefined ||
    input.slug !== undefined ||
    input.imageUrl !== undefined
  ) {
    await ctx.runMutation(
      components.vortexAuth.organizations.setOrganizationDetails,
      {
        organizationId,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      }
    );
  }

  if (input.brand !== undefined) {
    await ctx.runMutation(
      components.vortexAuth.organizations.setOrganizationDetails,
      {
        organizationId,
        brand: input.brand,
      }
    );
  }

  if (input.security !== undefined) {
    await ctx.runMutation(
      components.vortexAuth.organizations.setOrganizationDetails,
      {
        organizationId,
        security: input.security,
      }
    );
  }
}

/**
 * Mirror Core brand fields into Seal brandingSettings so signing page /
 * document emails keep reading local branding until fully cut over.
 */
export function mirrorBrandIntoBrandingSettings(
  current: Doc<"organizations">["brandingSettings"] | undefined,
  brand: SuiteOrgBrandUpdate
): NonNullable<Doc<"organizations">["brandingSettings"]> {
  const base = current ?? { enabled: false };
  const next = { ...base };

  if ("primaryColor" in brand) {
    next.brandColor =
      brand.primaryColor === null || brand.primaryColor === undefined
        ? undefined
        : brand.primaryColor;
  }
  if ("accentColor" in brand) {
    next.accentColor =
      brand.accentColor === null || brand.accentColor === undefined
        ? undefined
        : brand.accentColor;
  }
  if ("emailFromName" in brand) {
    next.emailFromName =
      brand.emailFromName === null || brand.emailFromName === undefined
        ? undefined
        : brand.emailFromName;
  }
  if ("emailReplyTo" in brand) {
    next.emailReplyTo =
      brand.emailReplyTo === null || brand.emailReplyTo === undefined
        ? undefined
        : brand.emailReplyTo;
  }
  if ("website" in brand) {
    next.companyWebsite =
      brand.website === null || brand.website === undefined
        ? undefined
        : brand.website;
  }

  const hasIdentity =
    Boolean(next.brandColor) ||
    Boolean(next.accentColor) ||
    Boolean(next.emailFromName) ||
    Boolean(next.emailReplyTo) ||
    Boolean(next.logoUrl) ||
    Boolean(next.companyWebsite);

  if (hasIdentity && next.enabled !== true) {
    next.enabled = true;
  }

  return next;
}

export async function lookupBetterAuthTwoFactorEnabled(
  ctx: OrgCtx,
  betterAuthUserId: string
): Promise<boolean> {
  const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", value: betterAuthUserId }],
  });
  if (!user || typeof user !== "object") {
    return false;
  }
  return (
    "twoFactorEnabled" in user &&
    (user as { twoFactorEnabled?: unknown }).twoFactorEnabled === true
  );
}

export async function enforceActiveOrgSecurityPolicy(
  ctx: OrgCtx,
  args: {
    organization: Doc<"organizations">;
    betterAuthUserId: string;
    sessionCreatedAt?: number | null | (() => Promise<number | null>);
  }
): Promise<void> {
  const { metadataJson } = await loadSuiteOrgBrandAndSecurity(
    ctx,
    args.organization
  );
  const policy = parseOrganizationSecurityPolicy(metadataJson);
  // Skip Better Auth adapter lookups when the org has no suite policy.
  // convex-test does not register the betterAuth component by default.
  if (
    policy.requireMfa !== true &&
    policy.sessionTimeoutMinutes === undefined
  ) {
    return;
  }
  const twoFactorEnabled =
    policy.requireMfa === true
      ? await lookupBetterAuthTwoFactorEnabled(ctx, args.betterAuthUserId)
      : false;
  const sessionCreatedAt =
    typeof args.sessionCreatedAt === "function"
      ? await args.sessionCreatedAt()
      : (args.sessionCreatedAt ?? null);
  const denial = evaluateOrganizationSecurityAccess({
    policy,
    twoFactorEnabled,
    sessionCreatedAt,
  });
  if (denial !== null) {
    throw new ConvexError({
      code: denial.code === "ORG_MFA_REQUIRED" ? "FORBIDDEN" : "UNAUTHORIZED",
      message: denial.message,
      authzCode: denial.code,
    });
  }
}

export async function setVortexAuthActiveOrganizationWithMfaGate(
  ctx: OrgWriteCtx,
  args: {
    vortexAuthUserId: string;
    vortexAuthOrganizationId: string;
    twoFactorEnabled: boolean;
  }
): Promise<void> {
  await ctx.runMutation(
    components.vortexAuth.organizations.setUserActiveOrganization,
    {
      userId: args.vortexAuthUserId as GenericId<"users">,
      organizationId:
        args.vortexAuthOrganizationId as GenericId<"organizations">,
      twoFactorEnabled: args.twoFactorEnabled,
    }
  );
}

/**
 * Preserve brand/security when upserting org anchor metadata (type only).
 */
export async function buildUpsertMetadataJsonPreservingSuitePolicy(
  ctx: OrgCtx,
  organization: Doc<"organizations">
): Promise<string> {
  const existing = await loadVortexAuthOrganizationMetadataJson(
    ctx,
    organization.vortexAuthOrganizationId
  );
  let base: Record<string, unknown> = {};
  if (existing && existing.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(existing);
      if (isRecord(parsed)) {
        base = { ...parsed };
      }
    } catch {
      base = {};
    }
  }
  base.type = organization.type;
  return JSON.stringify(base);
}
