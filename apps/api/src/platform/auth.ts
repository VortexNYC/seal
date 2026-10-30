import { apiKey } from "@better-auth/api-key";
import { renderPasswordReset } from "@seal/transactional";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import {
  createAccessControl,
  deviceAuthorization,
  genericOAuth,
  organization,
  twoFactor,
} from "better-auth/plugins";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import * as schema from "../global/schema.js";
import { sendEmail } from "./email.js";
import {
  attachConnectedAccount,
  readUserVortexOrganizations,
  vortexOAuthOrganizationSummarySchema,
  withVortexConnect,
} from "./vortex-connect.js";

// Org API keys (@better-auth/api-key references:"organization") check
// hasPermission({ apiKey: [action] }) — extend the default statements so
// admin/owner can mint, list, update, and revoke org-scoped keys.
const sealAc = createAccessControl({
  ...defaultStatements,
  apiKey: ["create", "read", "update", "delete"],
});

export async function createAuth(env: CloudflareBindings) {
  // samlify + SCIM graphs are heavy; lazy-import keeps cold-start CPU down.
  const [{ sso }, { scim }] = await Promise.all([
    import("@better-auth/sso"),
    import("@better-auth/scim"),
  ]);
  const db = createD1(env.D1);
  const drizzleFactory = drizzleAdapter(db, { provider: "sqlite", schema });

  const allowedOrigins =
    env.ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return betterAuth({
    // D1 has no interactive transactions. SCIM expects adapterConfig.transaction
    // to be a function — sequential fallback matches every non-txn adapter.
    database: (options: Parameters<typeof drizzleFactory>[0]) => {
      const instance = drizzleFactory(options);
      const adapterConfig = instance.options?.adapterConfig as
        | { transaction?: unknown }
        | undefined;
      if (adapterConfig && typeof adapterConfig.transaction !== "function") {
        adapterConfig.transaction = async (
          callback: (adapter: typeof instance) => Promise<unknown>
        ) => callback(instance);
      }
      return instance;
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: allowedOrigins,
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        const html = await renderPasswordReset({
          recipientName: user.name ?? "",
          resetUrl: url,
        });
        const result = await sendEmail(env, {
          to: user.email,
          subject: "Reset your Seal password",
          html,
        });
        if (!result.success) {
          console.error("[auth] reset password email failed:", result.error);
        }
      },
    },
    user: {
      additionalFields: {
        metadata: { type: "json", required: false },
      },
    },
    session: {
      additionalFields: {
        activeOrganizationId: { type: "string", required: false },
        activeTeamId: { type: "string", required: false },
      },
    },
    organization: {
      additionalFields: {
        metadata: { type: "json", required: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            try {
              const existingMemberships = await db
                .select({ organizationId: schema.member.organizationId })
                .from(schema.member)
                .where(eq(schema.member.userId, session.userId))
                .limit(1);
              if (existingMemberships.length > 0) {
                return;
              }
              const [userRow] = await db
                .select({ metadata: schema.user.metadata })
                .from(schema.user)
                .where(eq(schema.user.id, session.userId))
                .limit(1);
              const vortexOrgs = readUserVortexOrganizations(userRow?.metadata);
              const firstOrg = vortexOrgs[0];
              if (!firstOrg) {
                return;
              }
              const orgId = `vortex_${firstOrg.organizationId}`;
              const slug = `${firstOrg.slug}-${firstOrg.organizationId.slice(0, 6)}`;
              let orgMetadata = JSON.stringify({
                complianceCompleted: true,
                vortexOrganizationId: firstOrg.organizationId,
              });
              const approvedMerchants = firstOrg.merchants.filter(
                (m) => m.chargesApproved
              );
              if (
                approvedMerchants.length === 1 &&
                approvedMerchants[0] &&
                env.VORTEX_API_KEY
              ) {
                try {
                  const verifiedRecord = await attachConnectedAccount(env, {
                    merchantAccountId: approvedMerchants[0].merchantAccountId,
                  });
                  orgMetadata = withVortexConnect(orgMetadata, verifiedRecord);
                } catch {
                  // Leave unattached if live verification fails.
                }
              }
              const now = new Date();
              await db
                .insert(schema.organization)
                .values({
                  id: orgId,
                  name: firstOrg.name,
                  slug,
                  metadata: orgMetadata,
                  createdAt: now,
                })
                .onConflictDoNothing();
              await db
                .insert(schema.member)
                .values({
                  id: `mem_${orgId}_${session.userId}`,
                  organizationId: orgId,
                  userId: session.userId,
                  role: firstOrg.role,
                  createdAt: now,
                })
                .onConflictDoNothing();
              await db
                .update(schema.session)
                .set({ activeOrganizationId: orgId })
                .where(eq(schema.session.id, session.id));
            } catch (err) {
              console.error("[auth] vortex workspace bootstrap failed", {
                reason: err instanceof Error ? err.message : "unknown",
              });
            }
          },
        },
      },
    },
    plugins: [
      organization({
        ac: sealAc,
        roles: {
          owner: sealAc.newRole({
            ...ownerAc.statements,
            apiKey: ["create", "read", "update", "delete"],
          }),
          admin: sealAc.newRole({
            ...adminAc.statements,
            apiKey: ["create", "read", "update", "delete"],
          }),
          member: sealAc.newRole({
            ...memberAc.statements,
            apiKey: [],
          }),
        },
        teams: { enabled: false },
        dynamicAccessControl: { enabled: false },
      }),
      apiKey({
        configId: "seal",
        references: "organization",
        defaultPrefix: "seal_",
        enableMetadata: true,
        rateLimit: { enabled: false },
      }),
      deviceAuthorization(),
      twoFactor({
        issuer: "Seal",
      }),
      genericOAuth({
        config: [
          {
            providerId: "vortex",
            clientId: "seal",
            ...(env.VORTEX_OAUTH_CLIENT_SECRET
              ? { clientSecret: env.VORTEX_OAUTH_CLIENT_SECRET }
              : {}),
            authorizationUrl: "https://auth.vortex.nyc/oauth/authorize",
            tokenUrl: "https://auth.vortex.nyc/oauth/token",
            userInfoUrl: "https://auth.vortex.nyc/oauth/userinfo",
            pkce: true,
            scopes: ["openid", "profile", "email", "merchants:read"],
            mapProfileToUser: (profile) => {
              const parsedOrgs = z
                .array(vortexOAuthOrganizationSummarySchema)
                .safeParse(profile.organizations);
              return {
                metadata: JSON.stringify({
                  vortexOrganizations: parsedOrgs.success
                    ? parsedOrgs.data
                    : [],
                }),
              };
            },
          },
        ],
      }),
      sso({
        domainVerification: { enabled: true },
        organizationProvisioning: {
          defaultRole: "member",
        },
      }),
      scim({
        connections: [],
        managedConnections: {
          credentialHashSecret: env.BETTER_AUTH_SECRET,
        },
        identity: {
          reconcileUser: async (input, context) => {
            if (!input.active) {
              await context.database.update({
                model: "user",
                where: [{ field: "id", value: input.userId }],
                update: { banned: true, banReason: "scim.deactivated" },
              });
            } else {
              await context.database.update({
                model: "user",
                where: [{ field: "id", value: input.userId }],
                update: { banned: false, banReason: null },
              });
            }
          },
        },
        projection: {
          roles: {
            map: (input) =>
              input.source.type === "group" ? [input.source.displayName] : [],
            exists: (input) =>
              ["member", "admin", "owner"].includes(input.role),
          },
          reconcileUser: async (input, context) => {
            const database = context.database;
            const existing = await database.findOne({
              model: "member",
              where: [
                {
                  field: "organizationId",
                  value: input.provisioningDomainId,
                },
                { field: "userId", value: input.userId },
              ],
            });
            const role = input.grants[0]?.role ?? "member";
            if (!input.active) {
              if (
                existing &&
                typeof existing === "object" &&
                "id" in existing
              ) {
                await database.delete({
                  model: "member",
                  where: [
                    { field: "id", value: (existing as { id: string }).id },
                  ],
                });
              }
              return;
            }
            if (existing && typeof existing === "object" && "id" in existing) {
              const record = existing as { id: string; role?: string };
              if (record.role !== role) {
                await database.update({
                  model: "member",
                  where: [{ field: "id", value: record.id }],
                  update: { role },
                });
              }
              return;
            }
            await database.create({
              model: "member",
              data: {
                id: crypto.randomUUID(),
                organizationId: input.provisioningDomainId,
                userId: input.userId,
                role,
                createdAt: new Date(),
              },
            });
          },
        },
      }),
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
