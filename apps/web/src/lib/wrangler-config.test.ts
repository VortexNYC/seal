import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";
import { describe, expect, test } from "vitest";

const wranglerRouteValidator = v.object({
  pattern: v.string(),
  custom_domain: v.boolean(),
});

const wranglerConfigValidator = v.object({
  name: v.string(),
  routes: v.optional(v.array(wranglerRouteValidator)),
});

/**
 * Parse the JSONC wrangler config tolerantly: strip `//` line comments and
 * trailing commas (oxfmt enforces trailing commas in this repo), then
 * JSON.parse + validator. Avoids depending on a dedicated JSONC parser package.
 */
function loadWranglerConfig(): {
  name: string;
  routes?: Array<{ pattern: string; custom_domain: boolean }>;
} {
  const configPath = resolve(import.meta.dirname, "../../wrangler.jsonc");
  const raw = readFileSync(configPath, "utf8");
  const stripped = raw.replace(/\/\/[^\n]*/g, "").replace(/,(\s*[}\]])/g, "$1");
  const parsed: unknown = JSON.parse(stripped);
  return parse(wranglerConfigValidator, parsed);
}

describe("seal-web wrangler custom-domain routes", () => {
  const config = loadWranglerConfig();

  test("targets the seal-web Worker", () => {
    expect(config.name).toBe("seal-web");
  });

  test("binds sign.app.vortex.nyc as a custom domain", () => {
    const signRoute = config.routes?.find(
      (r) => r.pattern === "sign.app.vortex.nyc"
    );
    expect(
      signRoute,
      "sign.app.vortex.nyc route must be declared"
    ).toBeDefined();
    expect(signRoute?.custom_domain).toBe(true);
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

  test("does not bind any Sign marketing/docs domains (out of scope)", () => {
    const outOfScope = ["sign.vortex.nyc", "docs.sign.vortex.nyc"];
    for (const domain of outOfScope) {
      expect(
        config.routes?.some((r) => r.pattern === domain),
        `${domain} must NOT be bound on the web runtime (owned by VOR-33/VOR-9)`
      ).toBeFalsy();
    }
  });
});
