import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { member } from "../global/schema.js";
import app from "../index.js";
import { createAuth } from "../platform/auth.js";

const origin = (
  (
    env.ALLOWED_ORIGINS ??
    env.BETTER_AUTH_URL ??
    "http://localhost:8787"
  )
    .toString()
    .split(",")[0] ?? "http://localhost:8787"
).trim();

const scimBase = new URL("/api/auth/scim/v2", origin).toString();

async function getSessionCookie(): Promise<string> {
  const auth = await createAuth(env);
  const email = `scim-${crypto.randomUUID()}@example.com`;
  const password = "password123";
  await auth.api.signUpEmail({
    body: { email, password, name: "SCIM Admin" },
  });
  const signInRes = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = signInRes.headers
    .getSetCookie()
    .find((c) => c.includes("better-auth.session_token="));
  if (!cookie) {
    throw new Error("No session cookie");
  }
  return cookie;
}

async function createOrg(cookie: string): Promise<{ id: string; slug: string }> {
  const slug = `scim-${crypto.randomUUID().slice(0, 8)}`;
  const res = await app.fetch(
    new Request(new URL("/api/auth/organization/create", origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: origin,
      },
      body: JSON.stringify({ name: "SCIM Org", slug }),
    }),
    env
  );
  expect(res.status).toBe(200);
  const created = (await res.json()) as {
    id?: string;
    organization?: { id: string };
  };
  const id = created.id ?? created.organization?.id;
  expect(id).toBeTruthy();
  return { id: id!, slug };
}

function scimFetch(path: string, init: RequestInit = {}) {
  return app.fetch(
    new Request(new URL(path, scimBase).toString(), {
      ...init,
      headers: {
        "Content-Type": "application/scim+json",
        ...init.headers,
      },
    }),
    env
  );
}

describe("SEA-71 SCIM provisioning", () => {
  it("rejects SCIM requests without a bearer token", async () => {
    const res = await scimFetch("/api/auth/scim/v2/Users");
    expect(res.status).toBe(401);
  });

  it("mints a connection and provisions a user into the org", async () => {
    const cookie = await getSessionCookie();
    const org = await createOrg(cookie);

    const createConn = await app.fetch(
      new Request(
        new URL(`/api/organizations/${org.slug}/scim/connections`, origin),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
            Origin: origin,
          },
          body: JSON.stringify({}),
        }
      ),
      env
    );
    expect(createConn.status).toBe(201);
    const conn = (await createConn.json()) as {
      token: string;
      baseUrl: string;
      provisioningDomainId: string;
    };
    expect(conn.token.length).toBeGreaterThan(16);
    expect(conn.baseUrl).toContain("/scim/v2");
    expect(conn.provisioningDomainId).toBe(org.id);

    const list = await app.fetch(
      new Request(
        new URL(`/api/organizations/${org.slug}/scim/connections`, origin),
        { headers: { Cookie: cookie, Origin: origin } }
      ),
      env
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { connections: unknown[] };
    expect(listed.connections.length).toBeGreaterThanOrEqual(1);

    const userRes = await scimFetch("/api/auth/scim/v2/Users", {
      method: "POST",
      headers: { Authorization: `Bearer ${conn.token}` },
      body: JSON.stringify({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: "provisioned@example.com",
        emails: [{ value: "provisioned@example.com", primary: true }],
        active: true,
        displayName: "Provisioned User",
      }),
    });
    expect(userRes.status).toBe(201);
    const scimUser = (await userRes.json()) as {
      id: string;
      userName: string;
      active: boolean;
    };
    expect(scimUser.userName).toBe("provisioned@example.com");
    expect(scimUser.active).toBe(true);

    const db = createD1(env.D1);
    const rows = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.organizationId, org.id));
    expect(rows.some((r) => r.role === "member")).toBe(true);
  });
});
