import { beforeAll, describe, expect, test } from "vitest";

import type { TRUSTED_ORIGINS as TrustedOriginsType } from "../betterAuth";

let TRUSTED_ORIGINS: readonly string[];

beforeAll(async () => {
  // betterAuth.ts transitively imports auth.config.ts, which resolves the
  // Convex site URL at module load via createDefaultConvexAuthProvider. The
  // env must be present before the import executes; set it then dynamic-import.
  process.env.CONVEX_SITE_URL ||= "https://test.convex.site";
  process.env.CONVEX_CLOUD_URL ||= "https://test.convex.cloud";
  const mod = await import("../betterAuth");
  TRUSTED_ORIGINS = mod.TRUSTED_ORIGINS;
});

describe("Better-Auth trusted origins", () => {
  test("includes the Vortex Sign app origin", () => {
    expect(TRUSTED_ORIGINS).toContain("https://sign.app.vortex.nyc");
  });

  test("preserves the production app.seal.nyc origin", () => {
    expect(TRUSTED_ORIGINS).toContain("https://app.seal.nyc");
  });

  test("includes the actual staging origin (staging-app.seal.nyc)", () => {
    expect(TRUSTED_ORIGINS).toContain("https://staging-app.seal.nyc");
  });

  test("does NOT include the legacy non-resolving staging.seal.nyc", () => {
    expect(TRUSTED_ORIGINS).not.toContain("https://staging.seal.nyc");
  });

  test("retains local-dev origins", () => {
    expect(TRUSTED_ORIGINS).toContain("http://localhost:5173");
    expect(TRUSTED_ORIGINS).toContain("http://localhost:*");
    expect(TRUSTED_ORIGINS).toContain("http://seal.localhost:1355");
  });

  test("every origin is https except localhost/dev entries", () => {
    for (const origin of TRUSTED_ORIGINS) {
      const isLocalhost =
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.");
      const isSealLocalhost = origin.startsWith("http://seal.localhost");
      if (isLocalhost || isSealLocalhost) {
        expect(origin).toMatch(/^http:\/\//);
      } else {
        expect(origin, `${origin} should be https`).toMatch(/^https:\/\//);
      }
    }
  });

  test("has no duplicate origins", () => {
    expect(new Set(TRUSTED_ORIGINS).size).toBe(TRUSTED_ORIGINS.length);
  });

  test("no origin references the retired provider token", () => {
    for (const origin of TRUSTED_ORIGINS) {
      expect(origin).not.toMatch(/stri(?:pe|p)/i);
    }
  });
});

// Keep the type-only import referenced so lint does not flag it unused; it
// also documents the exported shape the runtime consumes.
export type _TrustedOriginsShape = typeof TrustedOriginsType;
