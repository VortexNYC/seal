function safeParseMetadata(
  value: string | null
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return null;
}

export const planLimits = {
  free: {
    documentsPerMonth: 1_000_000,
    storageBytes: 10 * 1024 * 1024 * 1024,
  },
  pro: {
    documentsPerMonth: 10_000_000,
    storageBytes: 100 * 1024 * 1024 * 1024,
  },
  enterprise: {
    documentsPerMonth: 100_000_000,
    storageBytes: 1024 * 1024 * 1024 * 1024,
  },
} as const;

export type Plan = keyof typeof planLimits;

export function getPlanFromMetadata(metadata: string | null): Plan {
  const parsed = safeParseMetadata(metadata);
  if (!parsed) return "free";
  const value =
    typeof parsed.plan === "string" ? parsed.plan.toLowerCase() : "free";
  if (value === "free" || value === "pro" || value === "enterprise") {
    return value;
  }
  return "free";
}
