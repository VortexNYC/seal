import { eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { aiThreads } from "../global/schema.js";
import { getSessionUser, type SessionUser } from "../platform/session.js";

export interface ThreadOwnership {
  organizationId: string;
  userId: string;
}

export function authorizeThreadAccess(
  user: SessionUser,
  thread: ThreadOwnership | undefined
): boolean {
  if (!thread) {
    return false;
  }

  if (!user.session?.activeOrganizationId) {
    return false;
  }

  if (thread.organizationId !== user.session.activeOrganizationId) {
    return false;
  }

  if (thread.userId !== user.user.id) {
    return false;
  }

  return true;
}

export async function authenticateAgentConnection(
  req: Request,
  threadId: string,
  env: CloudflareBindings
): Promise<Response | undefined> {
  if (!threadId) {
    return new Response("Missing thread ID", { status: 400 });
  }

  const user = await getSessionUser(env, req);
  if (!user?.session?.activeOrganizationId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createD1(env.D1);
  const threadRows = await db
    .select({
      organizationId: aiThreads.organizationId,
      userId: aiThreads.userId,
    })
    .from(aiThreads)
    .where(eq(aiThreads.threadId, threadId))
    .limit(1);

  const thread = threadRows[0];
  if (!authorizeThreadAccess(user, thread)) {
    return new Response("Forbidden", { status: 403 });
  }

  return undefined;
}
