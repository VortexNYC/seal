import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import forge from "node-forge";
import * as samlify from "samlify";
import { describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { member, ssoProvider, user } from "../global/schema.js";
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

const IDP_ENTITY_ID = "https://mock-idp.seal.test";
const IDP_SSO_URL = "https://mock-idp.seal.test/sso";

/** Ephemeral self-signed IdP material — never committed as a static secret. */
function mintMockIdp(): { certPem: string; keyPem: string; metadata: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: "mock-idp.seal.test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certBody = certPem.replace(/-----[^-]+-----|\s/g, "");
  const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${IDP_ENTITY_ID}">
  <IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data><X509Certificate>${certBody}</X509Certificate></X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${IDP_SSO_URL}"/>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${IDP_SSO_URL}"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;
  return { certPem, keyPem, metadata };
}

async function adminCookie(): Promise<string> {
  const auth = await createAuth(env);
  const email = `saml-${crypto.randomUUID()}@example.com`;
  const password = "password123";
  await auth.api.signUpEmail({
    body: { email, password, name: "SAML Admin" },
  });
  const res = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .find((c) => c.includes("better-auth.session_token="));
  if (!cookie) {
    throw new Error("no session cookie");
  }
  return cookie;
}

describe("SEA-66 SAML SSO handshake", () => {
  it("completes SP-initiated login and provisions org membership", async () => {
    const { certPem, keyPem, metadata: idpMetadata } = mintMockIdp();
    const cookie = await adminCookie();

    const createOrg = await app.fetch(
      new Request(new URL("/api/auth/organization/create", origin), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: origin,
        },
        body: JSON.stringify({
          name: "SAML Org",
          slug: `saml-${crypto.randomUUID().slice(0, 8)}`,
        }),
      }),
      env
    );
    expect(createOrg.status).toBe(200);
    const created = (await createOrg.json()) as {
      id?: string;
      organization?: { id: string };
    };
    const organizationId = created.id ?? created.organization?.id;
    expect(organizationId).toBeTruthy();

    const providerId = `mock-idp-${crypto.randomUUID().slice(0, 8)}`;
    const register = await app.fetch(
      new Request(new URL("/api/auth/sso/register", origin), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: origin,
        },
        body: JSON.stringify({
          providerId,
          issuer: origin,
          domain: "example.com",
          organizationId,
          samlConfig: {
            issuer: origin,
            entryPoint: IDP_SSO_URL,
            cert: certPem,
            idpMetadata: { entityID: IDP_ENTITY_ID, cert: certPem },
            wantAssertionsSigned: true,
          },
        }),
      }),
      env
    );
    expect(register.status).toBe(200);

    // Domain verification is required before sign-in (SEA-66).
    const db = createD1(env.D1);
    await db
      .update(ssoProvider)
      .set({ domainVerified: true })
      .where(eq(ssoProvider.providerId, providerId));

    const spMetaRes = await app.fetch(
      new Request(
        new URL(
          `/api/auth/sso/saml2/sp/metadata?providerId=${providerId}`,
          origin
        )
      ),
      env
    );
    expect(spMetaRes.status).toBe(200);
    const spMetadata = await spMetaRes.text();
    expect(spMetadata).toContain("EntityDescriptor");

    const sp = samlify.ServiceProvider({ metadata: spMetadata });
    const idp = samlify.IdentityProvider({
      metadata: idpMetadata,
      privateKey: keyPem,
      isAssertionSigned: true,
      encNameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    } as ConstructorParameters<typeof samlify.IdentityProvider>[0]);

    const signIn = await app.fetch(
      new Request(new URL("/api/auth/sign-in/sso", origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          callbackURL: `${origin}/sso-done`,
        }),
      }),
      env
    );
    expect(signIn.status).toBe(200);
    const { url: redirectUrl } = (await signIn.json()) as { url: string };
    const samlRequest = new URL(redirectUrl).searchParams.get("SAMLRequest");
    expect(samlRequest).toBeTruthy();

    const requestInfo = await idp.parseLoginRequest(sp, "redirect", {
      query: { SAMLRequest: samlRequest },
    });

    const email = `sso-${crypto.randomUUID()}@example.com`;
    const { context: samlResponse } = (await idp.createLoginResponse(
      sp,
      requestInfo as unknown as Parameters<typeof idp.createLoginResponse>[1],
      "post",
      { email }
    )) as { context: string };

    const acs = await app.fetch(
      new Request(new URL(`/api/auth/sso/saml2/sp/acs/${providerId}`, origin), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ SAMLResponse: samlResponse }).toString(),
        redirect: "manual",
      }),
      env
    );
    expect([302, 303]).toContain(acs.status);
    const cookies = acs.headers.getSetCookie();
    expect(cookies.some((c) => c.includes("better-auth.session_token="))).toBe(
      true
    );

    const rows = await db
      .select({ role: member.role })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.organizationId, organizationId!),
          eq(user.email, email)
        )
      );
    expect(rows).toEqual([{ role: "member" }]);
  });
});
