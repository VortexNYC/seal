import { z } from "zod";

import { createAuth } from "./auth.js";

const sessionResponseSchema = z.object({
  user: z.object({ id: z.string() }),
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
    return null;
  }

  try {
    const auth = createAuth(env);
    const result = await auth.api.getSession({ headers: request.headers });
    if (!result || result instanceof Response) {
      return null;
    }
    const parsed = sessionResponseSchema.safeParse(result);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
