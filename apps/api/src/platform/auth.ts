import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";

import { createD1 } from "../global/db.js";
import * as schema from "../global/schema.js";

export function createAuth(env: CloudflareBindings) {
  const db = createD1(env.D1);

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
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
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
