import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import mcpOauth from "./mcp-oauth.js";

function createApp() {
  const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
  app.route("/oauth/seal-mcp", mcpOauth);
  return app;
}

describe("MCP OAuth", () => {
  beforeEach(() => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;
  });

  it("returns 503 when no signing key is configured", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/jwks"),
      env
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toHaveProperty("error", "server_error");
  });

  it("exposes the public half of an EC signing key at the JWKS endpoint", async () => {
    const { privateKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const privateJwk = await exportJWK(privateKey);
    privateJwk.alg = "ES256";
    privateJwk.kid = "test-key-id";

    env.SEAL_MCP_SIGNING_KEY = JSON.stringify(privateJwk);
    env.SEAL_MCP_SIGNING_KEY_ID = "test-key-id";

    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/oauth/seal-mcp/jwks"),
      env
    );
    expect(response.status).toBe(200);
    const body = z
      .object({
        keys: z.array(z.unknown()),
      })
      .parse(await response.json());
    expect(body.keys).toHaveLength(1);

    const publicJwk = body.keys[0];
    expect(publicJwk).toEqual({
      kty: "EC",
      crv: "P-256",
      x: privateJwk.x,
      y: privateJwk.y,
      kid: "test-key-id",
      use: "sig",
    });
  });
});
