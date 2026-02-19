import type { ToolCtx } from "@convex-dev/agent";

import type { Id } from "../_generated/dataModel";

export type SealAICtx = ToolCtx & {
  organizationId: Id<"organizations">;
  userId: string;
  documentId?: Id<"documents">;
};
