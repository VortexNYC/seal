import type { apiTokens, member, organization } from "../global/schema.js";
import type { Auth } from "./auth.js";
import type { McpAccessToken } from "./mcp-auth.js";
import type { SessionUser } from "./session.js";

export type Variables = {
  auth: Auth;
  user: SessionUser | null;
  apiToken?: typeof apiTokens.$inferSelect;
  mcp?: McpAccessToken;
  organization: typeof organization.$inferSelect;
  membership: typeof member.$inferSelect;
};
