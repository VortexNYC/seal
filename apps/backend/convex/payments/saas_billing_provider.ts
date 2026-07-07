import { ConvexError } from "convex/values";

export type Env = {
  readonly [key: string]: string | undefined;
};

export type SaasBillingProvider = "stripe" | "vortex_billing";

const SAAS_ALLOWLIST_ENV = "VORTEX_BILLING_SAAS_ORGANIZATION_IDS";

export function selectSaasBillingProvider(
  organizationId: string,
  env: Env = process.env,
): SaasBillingProvider {
  return isOrganizationAllowlisted(organizationId, env[SAAS_ALLOWLIST_ENV])
    ? "vortex_billing"
    : "stripe";
}

function isOrganizationAllowlisted(
  organizationId: string,
  configured: string | undefined,
): boolean {
  if (configured === undefined || configured.trim() === "" || configured.trim() === "[]") {
    return false;
  }

  const normalized = configured.trim();
  if (normalized === "*") {
    return true;
  }

  if (normalized.startsWith("[")) {
    const parsed = parseJson(normalized, SAAS_ALLOWLIST_ENV);
    if (!Array.isArray(parsed)) {
      throw new ConvexError(`${SAAS_ALLOWLIST_ENV} must be a JSON string array, "*", or "[]"`);
    }

    return parsed.some((entry) => entry === organizationId);
  }

  return normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .includes(organizationId);
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConvexError(`${label} is not valid JSON: ${message}`);
  }
}
