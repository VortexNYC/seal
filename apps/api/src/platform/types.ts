import type { ApiKey } from "@better-auth/api-key";

import type { member, organization } from "../global/schema.js";
import type { Auth } from "./auth.js";
import type { McpAccessToken } from "./mcp-auth.js";
import type { SessionUser } from "./session.js";

export type Variables = {
  auth: Auth;
  user: SessionUser | null;
  apiToken?: ApiKey;
  mcp?: McpAccessToken;
  organization: typeof organization.$inferSelect;
  membership: typeof member.$inferSelect;
};
