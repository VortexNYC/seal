import { z } from "zod";

import { createAuth } from "./auth.js";

const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
  }),
  session: z
    .object({
      activeOrganizationId: z.string().optional().nullable(),
    })
    .optional(),
});

export type SessionUser = z.infer<typeof sessionResponseSchema>;

export async function getSessionUser(
  env: CloudflareBindings,
  request: Request
): Promise<SessionUser | null> {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    console.warn(
      "getSessionUser: BETTER_AUTH_SECRET or BETTER_AUTH_URL is not set"
    );
    return null;
  }

  try {
    const auth = await createAuth(env);
    const result = await auth.api.getSession({ headers: request.headers });
    if (!result || result instanceof Response) {
      console.warn(
        "getSessionUser: getSession returned no session",
        result instanceof Response ? `response ${result.status}` : result
      );
      return null;
    }
    const parsed = sessionResponseSchema.safeParse(result);
    if (!parsed.success) {
      console.warn(
        "getSessionUser: session shape mismatch",
        JSON.stringify(parsed.error.issues.slice(0, 5))
      );
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.error("getSessionUser: getSession threw", error);
    return null;
  }
}
