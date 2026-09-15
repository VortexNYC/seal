import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";
import { z } from "zod";

const wranglerRouteValidator = z.object({
  pattern: z.string(),
  custom_domain: z.boolean(),
});

const wranglerConfigValidator = z.object({
  name: z.string(),
  routes: z.array(wranglerRouteValidator).optional(),
});

/**
 * Parse the JSONC wrangler config tolerantly: strip `//` line comments and
 * trailing commas (oxfmt enforces trailing commas in this repo), then
 * JSON.parse + zod. Avoids depending on a dedicated JSONC parser package.
 */
function loadWranglerConfig(): {
  name: string;
  routes?: Array<{ pattern: string; custom_domain: boolean }>;
} {
  const configPath = resolve(import.meta.dirname, "../../wrangler.jsonc");
  const raw = readFileSync(configPath, "utf8");
  const stripped = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
  const parsed: unknown = JSON.parse(stripped);
  return wranglerConfigValidator.parse(parsed);
}

describe("seal-web wrangler custom-domain routes", () => {
  const config = loadWranglerConfig();

  test("targets the seal-web Worker", () => {
    expect(config.name).toBe("seal-web");
  });

  test("preserves the app.seal.nyc production custom domain", () => {
    const appRoute = config.routes?.find((r) => r.pattern === "app.seal.nyc");
    expect(appRoute, "app.seal.nyc route must be preserved").toBeDefined();
    expect(appRoute?.custom_domain).toBe(true);
  });

  test("every route uses custom_domain (not a route pattern script)", () => {
    for (const route of config.routes ?? []) {
      expect(
        route.custom_domain,
        `${route.pattern} must be custom_domain: true`
      ).toBe(true);
    }
  });

  test("does not bind out-of-scope custom domains", () => {
    const outOfScope = ["sign.example.com", "docs.sign.example.com"];
    for (const domain of outOfScope) {
      expect(
        config.routes?.some((r) => r.pattern === domain),
        `${domain} must NOT be bound on the web runtime`
      ).toBeFalsy();
    }
  });
});
