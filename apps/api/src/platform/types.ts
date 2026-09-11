import type { createAuth } from "./auth.js";
import type { McpAccessToken } from "./mcp-auth.js";
import type { SessionUser } from "./session.js";
import type { member, organization } from "../global/schema.js";

export type Variables = {
  auth: ReturnType<typeof createAuth>;
  user: SessionUser | null;
  mcp?: McpAccessToken;
  organization: typeof organization.$inferSelect;
  membership: typeof member.$inferSelect;
};
