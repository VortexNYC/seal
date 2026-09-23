import { PasswordResetEmail, render } from "@vortex-api/better-auth-ui/emails";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization, twoFactor } from "better-auth/plugins";

import { createD1 } from "../global/db.js";
import * as schema from "../global/schema.js";
import { sendEmail } from "./email.js";

export function createAuth(env: CloudflareBindings) {
  const db = createD1(env.D1);

  const allowedOrigins =
    env.ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
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
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
