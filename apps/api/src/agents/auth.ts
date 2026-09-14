import { and, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { aiThreads, member } from "../global/schema.js";
import { getSessionUser } from "../platform/session.js";

export interface ThreadOwnership {
  organizationId: string;
  userId: string;
}

export function authorizeThreadAccess(
  userId: string,
  organizationId: string,
  thread: ThreadOwnership | undefined
): boolean {
  if (!thread) {
    return false;
  }
  if (thread.userId !== userId) {
    return false;
  }
  if (thread.organizationId !== organizationId) {
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
  if (!user) {
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

  const membershipRows = thread
    ? await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, thread.organizationId),
            eq(member.userId, user.user.id)
          )
        )
        .limit(1)
    : [];

  if (
    !thread ||
    membershipRows.length === 0 ||
    !authorizeThreadAccess(user.user.id, thread.organizationId, thread)
  ) {
    return new Response("Not found", { status: 404 });
  }

  return undefined;
}
