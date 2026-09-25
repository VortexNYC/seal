import { PasswordResetEmail, render } from "@vortex-api/better-auth-ui/emails";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization, twoFactor } from "better-auth/plugins";

import { createD1 } from "../global/db.js";
import * as schema from "../global/schema.js";
import { sendEmail } from "./email.js";

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
        const html = await render(
          PasswordResetEmail({
            username: user.name,
            resetUrl: url,
            brandName: "Seal",
            brandColor: "#44403c",
          })
        );
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
    plugins: [
      organization({
        teams: { enabled: false },
        dynamicAccessControl: { enabled: false },
      }),
      twoFactor({
        issuer: "Seal",
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
